import "server-only";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { getCurrentSessionId, revokeOtherSessions, revokeSession as revokeSessionRaw } from "@/server/auth/session";
import { db } from "@/server/db";
import { DomainError } from "@/server/errors";
import type { Viewer } from "@/server/context";

export async function changePassword(viewer: Viewer, input: { currentPassword: string; newPassword: string }): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { id: viewer.user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) throw new DomainError("currentPasswordIncorrect");

  await db.user.update({ where: { id: viewer.user.id }, data: { passwordHash: await hashPassword(input.newPassword) } });
  const currentSessionId = await getCurrentSessionId();
  if (currentSessionId) await revokeOtherSessions(viewer.user.id, currentSessionId);
}

export async function revokeSession(viewer: Viewer, sessionId: string): Promise<void> {
  const currentId = await getCurrentSessionId();
  if (sessionId === currentId) throw new DomainError("cannotRevokeCurrentSession");
  await revokeSessionRaw(viewer.user.id, sessionId);
}

export async function revokeOtherSessionsForViewer(viewer: Viewer): Promise<void> {
  const currentId = await getCurrentSessionId();
  if (!currentId) throw new DomainError("generic");
  await revokeOtherSessions(viewer.user.id, currentId);
}
