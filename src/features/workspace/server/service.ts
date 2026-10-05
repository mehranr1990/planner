import "server-only";
import { randomBytes } from "node:crypto";
import { NOT_FOUND } from "@/lib/action-result";
import { recordActivity, recordAudit } from "@/server/activity";
import { db, isUniqueViolation } from "@/server/db";
import { DomainError } from "@/server/errors";
import { actorIn, type Viewer } from "@/server/context";
import { notify } from "@/server/notifications";
import { can, canChangeRole, canRemoveMember, type BaseRole } from "@/server/permissions/capabilities";

/** URL-safe slug with a random suffix. Non-Latin names fall back to "workspace-<hex>". */
export function slugify(name: string, suffix = randomBytes(3).toString("hex")): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "workspace"}-${suffix}`;
}

/** Creates a workspace with the viewer as OWNER and makes it their active context. */
export async function createWorkspace(viewer: Viewer, input: { name: string; timezone?: string }): Promise<{ id: string }> {
  const me = viewer.user.id;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const w = await tx.workspace.create({
          data: {
            name: input.name,
            slug: slugify(input.name),
            timezone: input.timezone ?? viewer.user.timezone,
            createdById: me,
            memberships: { create: { userId: me, role: "OWNER" } },
          },
          select: { id: true },
        });
        await tx.user.update({ where: { id: me }, data: { activeWorkspaceId: w.id } });
        await recordAudit(tx, { workspaceId: w.id, actorId: me, action: "workspace.created", targetType: "workspace", targetId: w.id });
        return { id: w.id };
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e; // slug collision → retry with a new suffix
    }
  }
  throw new DomainError("workspaceCreateFailed");
}

/** Personal context (null) or a workspace the viewer actively belongs to. */
export async function switchContext(viewer: Viewer, workspaceId: string | null) {
  if (workspaceId !== null && !actorIn(viewer, workspaceId)) throw new DomainError(NOT_FOUND);
  await db.user.update({ where: { id: viewer.user.id }, data: { activeWorkspaceId: workspaceId } });
}

/**
 * Role change under the capability model (canChangeRole) plus the last-owner guard.
 * The owner count is read inside the same transaction as the update.
 */
export async function changeMemberRole(viewer: Viewer, input: { workspaceId: string; userId: string; role: BaseRole }) {
  const actor = actorIn(viewer, input.workspaceId);
  if (!actor) throw new DomainError(NOT_FOUND);

  await db.$transaction(async (tx) => {
    const target = await tx.membership.findUnique({
      where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId } },
      select: { id: true, role: true, status: true },
    });
    if (!target || target.status !== "ACTIVE") throw new DomainError(NOT_FOUND);
    if (!canChangeRole(actor, { userId: input.userId, role: target.role as BaseRole }, input.role)) throw new DomainError("roleChangeForbidden");
    if (target.role === "OWNER" && input.role !== "OWNER") {
      const owners = await tx.membership.count({ where: { workspaceId: input.workspaceId, role: "OWNER", status: "ACTIVE" } });
      if (owners <= 1) throw new DomainError("lastOwner");
    }
    await tx.membership.update({ where: { id: target.id }, data: { role: input.role } });
    await recordAudit(tx, {
      workspaceId: input.workspaceId,
      actorId: viewer.user.id,
      action: "member.role_changed",
      targetType: "membership",
      targetId: target.id,
      before: { role: target.role },
      after: { role: input.role },
    });
    await recordActivity(tx, { workspaceId: input.workspaceId, actorId: viewer.user.id, entityType: "membership", entityId: target.id, action: "role_changed" });
    await notify(tx, {
      recipientId: input.userId,
      workspaceId: input.workspaceId,
      actorId: viewer.user.id,
      type: "WORKSPACE_ROLE_CHANGED",
      entityType: "membership",
      entityId: target.id,
      title: input.role,
      deepLink: "/team",
      dedupeKey: `membership:${target.id}:role_changed:${input.role}`,
    });
  });
}

/**
 * Ownership transfer — a dedicated privileged operation, not a `changeMemberRole` call repeated
 * twice: both role updates (new owner ← OWNER, previous owner ← ADMIN) happen inside one
 * transaction, so the workspace is never briefly left with zero or two owners even if something
 * fails partway, and no last-owner *count* check is needed (a swap can never change the count).
 * Only the current OWNER may call this; the target must be an active, non-GUEST member who isn't
 * the caller themselves.
 */
export async function transferOwnership(viewer: Viewer, input: { workspaceId: string; userId: string }): Promise<void> {
  const actor = actorIn(viewer, input.workspaceId);
  if (!actor) throw new DomainError(NOT_FOUND);
  if (actor.role !== "OWNER") throw new DomainError("roleChangeForbidden");
  if (input.userId === viewer.user.id) throw new DomainError("transferOwnershipSelf");

  await db.$transaction(async (tx) => {
    const target = await tx.membership.findUnique({
      where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId } },
      select: { id: true, role: true, status: true },
    });
    if (!target || target.status !== "ACTIVE") throw new DomainError(NOT_FOUND);
    if (target.role === "GUEST") throw new DomainError("transferOwnershipIneligible");

    const current = await tx.membership.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: viewer.user.id } },
      select: { id: true },
    });

    await tx.membership.update({ where: { id: target.id }, data: { role: "OWNER" } });
    await tx.membership.update({ where: { id: current.id }, data: { role: "ADMIN" } });

    // Defensive, not load-bearing: the two updates above already guarantee exactly one owner by
    // construction (a swap, never a decrement) — this only catches a logic error, never a race.
    const owners = await tx.membership.count({ where: { workspaceId: input.workspaceId, role: "OWNER", status: "ACTIVE" } });
    if (owners !== 1) throw new DomainError("generic");

    await recordAudit(tx, {
      workspaceId: input.workspaceId,
      actorId: viewer.user.id,
      action: "workspace.ownership_transferred",
      targetType: "membership",
      targetId: target.id,
      before: { ownerId: viewer.user.id },
      after: { ownerId: input.userId },
    });
    await recordActivity(tx, { workspaceId: input.workspaceId, actorId: viewer.user.id, entityType: "membership", entityId: target.id, action: "ownership_transferred" });
    await notify(tx, {
      recipientId: input.userId,
      workspaceId: input.workspaceId,
      actorId: viewer.user.id,
      type: "WORKSPACE_OWNERSHIP_TRANSFERRED",
      entityType: "membership",
      entityId: target.id,
      title: viewer.workspaces.find((w) => w.id === input.workspaceId)?.name ?? "",
      deepLink: "/team",
      dedupeKey: `membership:${target.id}:ownership_transferred`,
    });
  });
}

/** Removing a member deletes their membership outright; last-owner guard reuses canRemoveMember. */
export async function removeMember(viewer: Viewer, input: { workspaceId: string; userId: string }): Promise<void> {
  const actor = actorIn(viewer, input.workspaceId);
  if (!actor) throw new DomainError(NOT_FOUND);

  await db.$transaction(async (tx) => {
    const target = await tx.membership.findUnique({
      where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId } },
      select: { id: true, role: true, status: true },
    });
    if (!target || target.status !== "ACTIVE") throw new DomainError(NOT_FOUND);
    if (!canRemoveMember(actor, { userId: input.userId, role: target.role as BaseRole })) throw new DomainError("roleChangeForbidden");
    if (target.role === "OWNER") {
      const owners = await tx.membership.count({ where: { workspaceId: input.workspaceId, role: "OWNER", status: "ACTIVE" } });
      if (owners <= 1) throw new DomainError("lastOwner");
    }
    await tx.membership.delete({ where: { id: target.id } });
    await recordAudit(tx, { workspaceId: input.workspaceId, actorId: viewer.user.id, action: "member.removed", targetType: "membership", targetId: target.id });
    await recordActivity(tx, { workspaceId: input.workspaceId, actorId: viewer.user.id, entityType: "membership", entityId: target.id, action: "removed" });
  });
}

async function setMemberStatus(viewer: Viewer, input: { workspaceId: string; userId: string }, status: "ACTIVE" | "DEACTIVATED") {
  const actor = actorIn(viewer, input.workspaceId);
  if (!actor) throw new DomainError(NOT_FOUND);
  if (!can(actor, "members.deactivate")) throw new DomainError("roleChangeForbidden");

  await db.$transaction(async (tx) => {
    const target = await tx.membership.findUnique({
      where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId } },
      select: { id: true, role: true, status: true },
    });
    if (!target) throw new DomainError(NOT_FOUND);
    if (status === "DEACTIVATED") {
      if (target.role === "OWNER") throw new DomainError("lastOwner");
      if (target.status !== "ACTIVE") throw new DomainError(NOT_FOUND);
    } else if (target.status !== "DEACTIVATED") throw new DomainError(NOT_FOUND);

    await tx.membership.update({ where: { id: target.id }, data: { status, deactivatedAt: status === "DEACTIVATED" ? new Date() : null } });
    await recordAudit(tx, {
      workspaceId: input.workspaceId,
      actorId: viewer.user.id,
      action: status === "DEACTIVATED" ? "member.deactivated" : "member.reactivated",
      targetType: "membership",
      targetId: target.id,
    });
  });
}

export const deactivateMember = (viewer: Viewer, input: { workspaceId: string; userId: string }) => setMemberStatus(viewer, input, "DEACTIVATED");
export const reactivateMember = (viewer: Viewer, input: { workspaceId: string; userId: string }) => setMemberStatus(viewer, input, "ACTIVE");

export async function updateWorkspaceSettings(viewer: Viewer, input: { workspaceId: string; name?: string; iconUrl?: string | null; timezone?: string }): Promise<void> {
  const actor = actorIn(viewer, input.workspaceId);
  if (!actor) throw new DomainError(NOT_FOUND);
  if (!can(actor, "workspace.manage")) throw new DomainError("roleChangeForbidden");

  await db.$transaction(async (tx) => {
    const before = await tx.workspace.findUniqueOrThrow({ where: { id: input.workspaceId }, select: { name: true, iconUrl: true, timezone: true } });
    await tx.workspace.update({
      where: { id: input.workspaceId },
      data: { name: input.name, iconUrl: input.iconUrl, timezone: input.timezone },
    });
    await recordAudit(tx, {
      workspaceId: input.workspaceId,
      actorId: viewer.user.id,
      action: "workspace.settings_updated",
      targetType: "workspace",
      targetId: input.workspaceId,
      before,
      after: { name: input.name ?? before.name, iconUrl: input.iconUrl ?? before.iconUrl, timezone: input.timezone ?? before.timezone },
    });
  });
}
