import "server-only";
import { randomBytes } from "node:crypto";
import { NOT_FOUND } from "@/lib/action-result";
import { recordActivity, recordAudit } from "@/server/activity";
import { db, isUniqueViolation } from "@/server/db";
import { DomainError } from "@/server/errors";
import { actorIn, type Viewer } from "@/server/context";
import { canChangeRole, type BaseRole } from "@/server/permissions/capabilities";

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
  });
}
