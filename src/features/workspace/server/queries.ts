import "server-only";
import { db } from "@/server/db";
import { actorIn, type Viewer } from "@/server/context";
import { can, canChangeRole, type BaseRole } from "@/server/permissions/capabilities";

/** Member directory for a workspace. Requires members.view; guests get null (treated as not found). */
export async function listMembers(viewer: Viewer, workspaceId: string) {
  const actor = actorIn(viewer, workspaceId);
  if (!can(actor, "members.view")) return null;
  const members = await db.membership.findMany({
    where: { workspaceId, status: "ACTIVE" },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    select: {
      role: true,
      joinedAt: true,
      user: { select: { id: true, name: true, avatarUrl: true, timezone: true } },
    },
    take: 500,
  });
  return members.map((m) => ({
    user: m.user,
    role: m.role as BaseRole,
    joinedAt: m.joinedAt.toISOString(),
    // Pre-computed per row so the UI only offers changes the server will accept.
    assignableRoles: (["OWNER", "ADMIN", "MANAGER", "MEMBER", "GUEST"] as const).filter(
      (r) => r !== m.role && canChangeRole(actor!, { userId: m.user.id, role: m.role as BaseRole }, r),
    ),
  }));
}
