import "server-only";
import { db } from "@/server/db";
import { actorIn, type Viewer } from "@/server/context";
import { can } from "@/server/permissions/capabilities";

export async function listTeams(viewer: Viewer, workspaceId: string) {
  const actor = actorIn(viewer, workspaceId);
  if (!can(actor, "members.view")) return null;
  const teams = await db.team.findMany({
    where: { workspaceId, archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, description: true, members: { select: { user: { select: { id: true, name: true, avatarUrl: true } } } } },
  });
  return teams.map((t) => ({ id: t.id, name: t.name, description: t.description, members: t.members.map((m) => m.user) }));
}

export async function getTeam(viewer: Viewer, teamId: string) {
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      description: true,
      workspaceId: true,
      archivedAt: true,
      members: { select: { role: true, user: { select: { id: true, name: true, avatarUrl: true, timezone: true } } } },
    },
  });
  if (!team) return null;
  const actor = actorIn(viewer, team.workspaceId);
  if (!can(actor, "members.view")) return null;
  return team;
}
