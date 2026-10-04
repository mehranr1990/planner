import "server-only";
import { db } from "@/server/db";
import { actorIn, type Viewer } from "@/server/context";
import { canManageInvitations } from "./access";

export async function listInvitations(viewer: Viewer, workspaceId: string) {
  const actor = actorIn(viewer, workspaceId);
  if (!canManageInvitations(actor)) return null;
  const invitations = await db.invitation.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, email: true, role: true, isExternal: true, status: true, expiresAt: true, createdAt: true },
  });
  return invitations.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString(), createdAt: i.createdAt.toISOString() }));
}
