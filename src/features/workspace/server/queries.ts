import "server-only";
import { db } from "@/server/db";
import { actorIn, type Viewer } from "@/server/context";
import { can, canChangeRole, canRemoveMember, type BaseRole } from "@/server/permissions/capabilities";

/** Member directory for a workspace. Requires members.view; guests get null (treated as not found). */
export async function listMembers(viewer: Viewer, workspaceId: string, status: "ACTIVE" | "DEACTIVATED" = "ACTIVE") {
  const actor = actorIn(viewer, workspaceId);
  if (!can(actor, "members.view")) return null;
  const members = await db.membership.findMany({
    where: { workspaceId, status, role: { not: "GUEST" } },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    select: {
      role: true,
      status: true,
      joinedAt: true,
      user: { select: { id: true, name: true, avatarUrl: true, timezone: true } },
    },
    take: 500,
  });
  return members.map((m) => ({
    user: m.user,
    role: m.role as BaseRole,
    status: m.status,
    joinedAt: m.joinedAt.toISOString(),
    // Pre-computed per row so the UI only offers changes the server will accept.
    assignableRoles: (["OWNER", "ADMIN", "MANAGER", "MEMBER", "GUEST"] as const).filter(
      (r) => r !== m.role && canChangeRole(actor!, { userId: m.user.id, role: m.role as BaseRole }, r),
    ),
    canRemove: canRemoveMember(actor!, { userId: m.user.id, role: m.role as BaseRole }),
    canDeactivate: can(actor, "members.deactivate") && m.role !== "OWNER",
    // Ownership transfer is a dedicated privileged operation (never a role-select option): only the
    // current OWNER sees it, only on an active, non-GUEST member who isn't themselves.
    canTransferOwnershipTo: actor!.role === "OWNER" && m.status === "ACTIVE" && m.role !== "GUEST" && m.user.id !== actor!.userId,
  }));
}

/** Guests and external collaborators — kept out of the main directory (Q-PERM-4: no directory access for guests themselves). */
export async function listGuests(viewer: Viewer, workspaceId: string) {
  const actor = actorIn(viewer, workspaceId);
  if (!can(actor, "members.view")) return null;
  const guests = await db.membership.findMany({
    where: { workspaceId, status: "ACTIVE", role: "GUEST" },
    orderBy: { joinedAt: "asc" },
    select: {
      isExternal: true,
      joinedAt: true,
      user: { select: { id: true, name: true, avatarUrl: true, timezone: true } },
    },
    take: 500,
  });
  return guests.map((g) => ({
    user: g.user,
    isExternal: g.isExternal,
    joinedAt: g.joinedAt.toISOString(),
    canRemove: canRemoveMember(actor!, { userId: g.user.id, role: "GUEST" }),
  }));
}
