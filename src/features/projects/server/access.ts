import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { can } from "@/server/permissions/capabilities";
import { actorIn, type Viewer } from "@/server/context";

// Project visibility mirrors task visibility (see features/tasks/server/access.ts).

export function visibleProjectsWhere(viewer: Viewer): Prisma.ProjectWhereInput {
  const me = viewer.user.id;
  const branches: Prisma.ProjectWhereInput[] = [{ scope: "PERSONAL", ownerId: me }];
  for (const ws of viewer.workspaces) {
    if (can(ws.actor, "projects.view_all")) {
      branches.push({ workspaceId: ws.id });
      continue;
    }
    const related: Prisma.ProjectWhereInput[] = [{ ownerId: me }, { members: { some: { userId: me } } }];
    if (ws.actor.role !== "GUEST") related.push({ visibility: "WORKSPACE" });
    branches.push({ workspaceId: ws.id, OR: related });
  }
  return { OR: branches };
}

const policySelect = {
  id: true,
  scope: true,
  workspaceId: true,
  ownerId: true,
  archivedAt: true,
  members: { select: { userId: true, role: true } },
} satisfies Prisma.ProjectSelect;

export type ProjectPolicyRecord = Prisma.ProjectGetPayload<{ select: typeof policySelect }>;

export async function findVisibleProject(viewer: Viewer, projectId: string): Promise<ProjectPolicyRecord | null> {
  return db.project.findFirst({ where: { AND: [{ id: projectId }, visibleProjectsWhere(viewer)] }, select: policySelect });
}

export function canEditProject(viewer: Viewer, project: ProjectPolicyRecord): boolean {
  const me = viewer.user.id;
  if (project.scope === "PERSONAL") return project.ownerId === me;
  const actor = project.workspaceId ? actorIn(viewer, project.workspaceId) : null;
  if (!actor) return false;
  if (can(actor, "projects.edit") || project.ownerId === me) return true;
  return project.members.some((m) => m.userId === me && m.role === "LEAD");
}

/** Adding tasks to a project: editors and leads, or anyone who can edit the project. */
export function canAddTasksToProject(viewer: Viewer, project: ProjectPolicyRecord): boolean {
  if (project.archivedAt) return false;
  if (canEditProject(viewer, project)) return true;
  const me = viewer.user.id;
  if (project.scope === "WORKSPACE" && project.workspaceId) {
    const actor = actorIn(viewer, project.workspaceId);
    if (!can(actor, "tasks.create")) return false;
    return project.members.some((m) => m.userId === me && m.role !== "VIEWER");
  }
  return false;
}
