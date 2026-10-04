import "server-only";
import { NOT_FOUND } from "@/lib/action-result";
import { emailProvider } from "@/server/email";
import { generateToken, hashToken } from "@/server/auth/token";
import { recordActivity, recordAudit } from "@/server/activity";
import { actorIn, type Viewer } from "@/server/context";
import { db, isUniqueViolation } from "@/server/db";
import { DomainError } from "@/server/errors";
import { notify } from "@/server/notifications";
import type { BaseRole } from "@/server/permissions/capabilities";
import { canManageInvitations, canSendInvitation } from "./access";

const INVITE_EXPIRY_MS = 7 * 86_400_000;
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

function inviteUrl(token: string): string {
  return `${APP_URL}/invite/${token}`;
}

export async function sendInvitation(
  viewer: Viewer,
  input: { workspaceId: string; email: string; role: BaseRole; isExternal?: boolean },
): Promise<{ id: string }> {
  const actor = actorIn(viewer, input.workspaceId);
  if (!actor) throw new DomainError(NOT_FOUND);
  if (!canSendInvitation(actor, input.role)) throw new DomainError("invitationForbidden");

  const email = input.email.trim().toLowerCase();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

  let invitation: { id: string };
  try {
    invitation = await db.$transaction(async (tx) => {
      const created = await tx.invitation.create({
        data: {
          workspaceId: input.workspaceId,
          email,
          role: input.role,
          isExternal: input.isExternal ?? false,
          tokenHash: hashToken(token),
          invitedById: viewer.user.id,
          expiresAt,
        },
        select: { id: true },
      });
      await recordAudit(tx, {
        workspaceId: input.workspaceId,
        actorId: viewer.user.id,
        action: "invitation.sent",
        targetType: "invitation",
        targetId: created.id,
        after: { email, role: input.role },
      });
      return created;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new DomainError("invitationAlreadyPending");
    throw e;
  }

  const workspace = await db.workspace.findUnique({ where: { id: input.workspaceId }, select: { name: true } });
  await emailProvider
    .send({ to: email, template: "invitation", data: { workspaceName: workspace?.name ?? "", inviterName: viewer.user.name, inviteUrl: inviteUrl(token) } })
    .catch((e) => console.error("[invitations] email send failed", e instanceof Error ? e.message : e));

  return invitation;
}

async function requireManageableInvitation(viewer: Viewer, invitationId: string) {
  const invitation = await db.invitation.findUnique({
    where: { id: invitationId },
    select: { id: true, workspaceId: true, email: true, role: true, status: true, invitedById: true },
  });
  if (!invitation) throw new DomainError(NOT_FOUND);
  const actor = actorIn(viewer, invitation.workspaceId);
  if (!actor) throw new DomainError(NOT_FOUND);
  if (!canManageInvitations(actor)) throw new DomainError("invitationForbidden");
  return invitation;
}

export async function revokeInvitation(viewer: Viewer, invitationId: string): Promise<void> {
  const invitation = await requireManageableInvitation(viewer, invitationId);
  if (invitation.status !== "PENDING") throw new DomainError("invitationInvalid");
  await db.$transaction(async (tx) => {
    await tx.invitation.update({ where: { id: invitation.id }, data: { status: "REVOKED", respondedAt: new Date() } });
    await recordAudit(tx, {
      workspaceId: invitation.workspaceId,
      actorId: viewer.user.id,
      action: "invitation.revoked",
      targetType: "invitation",
      targetId: invitation.id,
    });
  });
}

export async function resendInvitation(viewer: Viewer, invitationId: string): Promise<void> {
  const invitation = await requireManageableInvitation(viewer, invitationId);
  if (invitation.status !== "PENDING") throw new DomainError("invitationInvalid");

  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);
  await db.$transaction(async (tx) => {
    await tx.invitation.update({ where: { id: invitation.id }, data: { tokenHash: hashToken(token), expiresAt } });
    await recordAudit(tx, {
      workspaceId: invitation.workspaceId,
      actorId: viewer.user.id,
      action: "invitation.sent",
      targetType: "invitation",
      targetId: invitation.id,
      after: { email: invitation.email, role: invitation.role },
    });
  });

  const workspace = await db.workspace.findUnique({ where: { id: invitation.workspaceId }, select: { name: true } });
  await emailProvider
    .send({ to: invitation.email, template: "invitation", data: { workspaceName: workspace?.name ?? "", inviterName: viewer.user.name, inviteUrl: inviteUrl(token) } })
    .catch((e) => console.error("[invitations] email send failed", e instanceof Error ? e.message : e));
}

export type InvitationPreview =
  | { state: "valid"; workspaceName: string; email: string; role: BaseRole }
  | { state: "expired" | "revoked" | "accepted" | "invalid" };

/** Unauthenticated, token-scoped read — the invitee's own token, no session required. */
export async function previewInvitation(token: string): Promise<InvitationPreview> {
  const invitation = await db.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { status: true, expiresAt: true, email: true, role: true, workspace: { select: { name: true } } },
  });
  if (!invitation) return { state: "invalid" };
  if (invitation.status === "REVOKED") return { state: "revoked" };
  if (invitation.status === "ACCEPTED") return { state: "accepted" };
  if (invitation.status === "EXPIRED" || invitation.expiresAt.getTime() <= Date.now()) return { state: "expired" };
  return { state: "valid", workspaceName: invitation.workspace.name, email: invitation.email, role: invitation.role as BaseRole };
}

/** Accepting is a token-scoped action: the caller must already be signed in as the matching email. */
export async function acceptInvitation(token: string, userId: string): Promise<{ workspaceId: string }> {
  const invitation = await db.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, workspaceId: true, email: true, role: true, isExternal: true, status: true, expiresAt: true, invitedById: true, workspace: { select: { name: true } } },
  });
  if (!invitation) throw new DomainError("invitationInvalid");
  if (invitation.status === "REVOKED") throw new DomainError("invitationRevoked");
  if (invitation.status === "ACCEPTED") throw new DomainError("invitationInvalid");
  if (invitation.status === "EXPIRED" || invitation.expiresAt.getTime() <= Date.now()) throw new DomainError("invitationExpired");

  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) throw new DomainError(NOT_FOUND);
  if (user.email.toLowerCase() !== invitation.email.toLowerCase()) throw new DomainError("invitationEmailMismatch");

  const existing = await db.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
    select: { status: true },
  });
  if (existing) throw new DomainError("invitationAlreadyMember");

  await db.$transaction(async (tx) => {
    const membership = await tx.membership.create({
      data: { workspaceId: invitation.workspaceId, userId, role: invitation.role, isExternal: invitation.isExternal },
      select: { id: true },
    });
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", acceptedById: userId, acceptedMembershipId: membership.id, respondedAt: new Date() },
    });
    await tx.user.update({ where: { id: userId }, data: { activeWorkspaceId: invitation.workspaceId } });
    await recordAudit(tx, {
      workspaceId: invitation.workspaceId,
      actorId: userId,
      action: "invitation.accepted",
      targetType: "invitation",
      targetId: invitation.id,
    });
    await recordActivity(tx, { workspaceId: invitation.workspaceId, actorId: userId, entityType: "membership", entityId: membership.id, action: "joined" });
    await notify(tx, {
      recipientId: invitation.invitedById,
      workspaceId: invitation.workspaceId,
      actorId: userId,
      type: "INVITATION",
      entityType: "invitation",
      entityId: invitation.id,
      title: invitation.workspace.name,
      deepLink: "/team",
      dedupeKey: `invitation:${invitation.id}:accepted`,
    });
  });

  return { workspaceId: invitation.workspaceId };
}
