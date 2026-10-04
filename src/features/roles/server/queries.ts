import "server-only";
import { db } from "@/server/db";
import { actorIn, type Viewer } from "@/server/context";
import { canManageRoles } from "./access";

export async function listCustomRoles(viewer: Viewer, workspaceId: string) {
  const actor = actorIn(viewer, workspaceId);
  if (!canManageRoles(actor)) return null;
  const roles = await db.workspaceRole.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, baseRole: true, capabilities: true, _count: { select: { memberships: true } } },
  });
  return roles.map((r) => ({ id: r.id, name: r.name, baseRole: r.baseRole, capabilities: r.capabilities, memberCount: r._count.memberships }));
}
