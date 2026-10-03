import "server-only";
import { fromDbDate, todayIn, toDbDate, type CalendarDate } from "@/lib/time";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import type { Viewer } from "@/server/context";
import { OPEN_STATUSES, type PersonRef } from "@/features/tasks/types";
import { canAddTasksToProject, canEditProject, findVisibleProject, visibleProjectsWhere } from "./access";

export type ProjectStatus = "PLANNED" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
export type ProjectHealth = "ON_TRACK" | "AT_RISK" | "OFF_TRACK";

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  color: string;
  status: ProjectStatus;
  health: ProjectHealth;
  targetOn: CalendarDate | null;
  context: { kind: "personal" } | { kind: "workspace"; id: string; name: string };
  openTasks: number;
  doneTasks: number;
  overdueTasks: number;
  /** Up to 5 members (preview) with their open assigned tasks in this project. */
  members: (PersonRef & { openAssigned: number })[];
  memberCount: number;
}

export async function listProjects(viewer: Viewer, opts: { workspaceId?: string | null; includeArchived?: boolean; ids?: string[] } = {}) {
  const scopeFilter = opts.workspaceId === undefined ? {} : opts.workspaceId === null ? { scope: "PERSONAL" as const } : { workspaceId: opts.workspaceId };
  const projects = await db.project.findMany({
    where: { AND: [visibleProjectsWhere(viewer), scopeFilter, opts.includeArchived ? {} : { archivedAt: null }, opts.ids ? { id: { in: opts.ids } } : {}] },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 200,
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      status: true,
      health: true,
      targetOn: true,
      workspace: { select: { id: true, name: true } },
      members: { take: 5, orderBy: [{ role: "asc" }, { addedAt: "asc" }], select: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      _count: { select: { members: true } },
    },
  });
  if (projects.length === 0) return [];

  // One grouped query for task counts across all listed projects (no N+1).
  const ids = projects.map((p) => p.id);
  const today = toDbDate(todayIn(viewer.user.timezone));
  const [byStatus, overdue, allocation] = await Promise.all([
    db.task.groupBy({ by: ["projectId", "status"], where: { projectId: { in: ids }, deletedAt: null, archivedAt: null, parentId: null }, _count: true }),
    db.task.groupBy({
      by: ["projectId"],
      where: { projectId: { in: ids }, deletedAt: null, archivedAt: null, parentId: null, status: { in: [...OPEN_STATUSES] }, dueOn: { lt: today } },
      _count: true,
    }),
    // Open, assigned tasks per (project, member) — the reference's "task allocation" badges.
    db.$queryRaw<{ project_id: string; user_id: string; n: bigint }[]>`
      SELECT t.project_id, a.user_id, COUNT(*)::bigint AS n
      FROM task_assignees a
      JOIN tasks t ON t.id = a.task_id
      WHERE t.project_id IN (${Prisma.join(ids)})
        AND t.deleted_at IS NULL AND t.archived_at IS NULL AND t.parent_id IS NULL
        AND t.status IN ('TODO', 'IN_PROGRESS', 'BLOCKED')
      GROUP BY t.project_id, a.user_id`,
  ]);
  const allocated = new Map(allocation.map((r) => [`${r.project_id}:${r.user_id}`, Number(r.n)]));

  return projects.map((p): ProjectSummary => {
    const counts = byStatus.filter((c) => c.projectId === p.id);
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      color: p.color,
      status: p.status,
      health: p.health,
      targetOn: p.targetOn ? fromDbDate(p.targetOn) : null,
      context: p.workspace ? { kind: "workspace", id: p.workspace.id, name: p.workspace.name } : { kind: "personal" },
      openTasks: counts.filter((c) => (OPEN_STATUSES as readonly string[]).includes(c.status)).reduce((s, c) => s + c._count, 0),
      doneTasks: counts.filter((c) => c.status === "DONE").reduce((s, c) => s + c._count, 0),
      overdueTasks: overdue.find((o) => o.projectId === p.id)?._count ?? 0,
      members: p.members.map((m) => ({ ...m.user, openAssigned: allocated.get(`${p.id}:${m.user.id}`) ?? 0 })),
      memberCount: p._count.members,
    };
  });
}

export async function getProject(viewer: Viewer, projectId: string) {
  const policy = await findVisibleProject(viewer, projectId);
  if (!policy) return null;
  const [summary] = await listProjects(viewer, { includeArchived: true, ids: [projectId] });
  if (!summary) return null;
  return {
    ...summary,
    archived: policy.archivedAt !== null,
    canEdit: canEditProject(viewer, policy),
    canAddTasks: canAddTasksToProject(viewer, policy),
    scope: policy.scope,
    workspaceId: policy.workspaceId,
  };
}

export async function listProjectOptions(viewer: Viewer) {
  const projects = await db.project.findMany({
    where: { AND: [visibleProjectsWhere(viewer), { archivedAt: null }] },
    orderBy: { name: "asc" },
    take: 200,
    select: { id: true, name: true, color: true, workspaceId: true },
  });
  return projects;
}
