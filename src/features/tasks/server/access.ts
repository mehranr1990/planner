import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { can } from "@/server/permissions/capabilities";
import { actorIn, type Viewer } from "@/server/context";

// Object-level task authorization. Workspace capabilities come from the central capability
// model; this file adds the relationship rules (owner, assignee, project membership).
//
// Visibility:
//   PERSONAL   → owner, or a user the task was directly shared with (assignee/watcher).
//                Sharing a task never exposes anything else of the owner's.
//   WORKSPACE  → active member AND one of: tasks.view_all · owner · creator · assignee · watcher ·
//                project member · (non-guest AND project visibility = WORKSPACE).

export function visibleTasksWhere(viewer: Viewer): Prisma.TaskWhereInput {
  const me = viewer.user.id;
  const branches: Prisma.TaskWhereInput[] = [
    {
      scope: "PERSONAL",
      OR: [{ ownerId: me }, { assignees: { some: { userId: me } } }, { watchers: { some: { userId: me } } }],
    },
  ];
  for (const ws of viewer.workspaces) {
    if (can(ws.actor, "tasks.view_all")) {
      branches.push({ workspaceId: ws.id });
      continue;
    }
    const related: Prisma.TaskWhereInput[] = [
      { ownerId: me },
      { createdById: me },
      { assignees: { some: { userId: me } } },
      { watchers: { some: { userId: me } } },
      { project: { members: { some: { userId: me } } } },
    ];
    if (ws.actor.role !== "GUEST") related.push({ project: { visibility: "WORKSPACE", archivedAt: null } });
    branches.push({ workspaceId: ws.id, OR: related });
  }
  return { deletedAt: null, OR: branches };
}

const policySelect = {
  id: true,
  scope: true,
  workspaceId: true,
  ownerId: true,
  createdById: true,
  version: true,
  seriesId: true,
  occurrenceOn: true,
  status: true,
  title: true,
  parentId: true,
  assignees: { select: { userId: true } },
  watchers: { select: { userId: true } },
  project: { select: { id: true, ownerId: true, visibility: true, members: { select: { userId: true, role: true } } } },
} satisfies Prisma.TaskSelect;

export type TaskPolicyRecord = Prisma.TaskGetPayload<{ select: typeof policySelect }>;

/**
 * Everyone with a standing interest in this task's lifecycle — owner, assignees, watchers —
 * deduped and excluding `excludeUserId` (the actor; never self-notify). Shared by every
 * watcher-policy notification (status/schedule changes, new comments, dependency unblocks) so
 * the recipient set is computed exactly once, consistently.
 */
export function taskNotifiableRecipients(task: Pick<TaskPolicyRecord, "ownerId" | "assignees" | "watchers">, excludeUserId: string): string[] {
  const ids = new Set<string>([task.ownerId, ...task.assignees.map((a) => a.userId), ...task.watchers.map((w) => w.userId)]);
  ids.delete(excludeUserId);
  return [...ids];
}

/** Loads a task only if the viewer may see it; otherwise null (callers report NOT_FOUND). */
export async function findVisibleTask(viewer: Viewer, taskId: string): Promise<TaskPolicyRecord | null> {
  return db.task.findFirst({ where: { AND: [{ id: taskId }, visibleTasksWhere(viewer)] }, select: policySelect });
}

/** Batched variant of `findVisibleTask` for bulk operations (Batch 4) — only the ids the viewer
 * can actually see come back; a bogus/inaccessible id in the request is simply absent, never an error. */
export async function findVisibleTasks(viewer: Viewer, taskIds: string[]): Promise<TaskPolicyRecord[]> {
  if (taskIds.length === 0) return [];
  return db.task.findMany({ where: { AND: [{ id: { in: taskIds } }, visibleTasksWhere(viewer)] }, select: policySelect });
}

function projectRole(task: TaskPolicyRecord, userId: string) {
  return task.project?.members.find((m) => m.userId === userId)?.role ?? null;
}

/** Edit covers title, schedule, priority, status, completion, description, checklist. */
export function canEditTask(viewer: Viewer, task: TaskPolicyRecord): boolean {
  const me = viewer.user.id;
  if (task.scope === "PERSONAL") return task.ownerId === me || task.assignees.some((a) => a.userId === me);
  const actor = task.workspaceId ? actorIn(viewer, task.workspaceId) : null;
  if (!actor) return false;
  if (can(actor, "tasks.edit_any")) return true;
  if (task.ownerId === me || task.createdById === me || task.assignees.some((a) => a.userId === me)) return true;
  const role = projectRole(task, me);
  return role === "LEAD" || role === "EDITOR";
}

export function canDeleteTask(viewer: Viewer, task: TaskPolicyRecord): boolean {
  const me = viewer.user.id;
  if (task.scope === "PERSONAL") return task.ownerId === me;
  const actor = task.workspaceId ? actorIn(viewer, task.workspaceId) : null;
  if (!actor) return false;
  return can(actor, "tasks.delete") || task.createdById === me || projectRole(task, me) === "LEAD";
}

export function canAssignTask(viewer: Viewer, task: TaskPolicyRecord): boolean {
  if (task.scope === "PERSONAL") return task.ownerId === viewer.user.id;
  const actor = task.workspaceId ? actorIn(viewer, task.workspaceId) : null;
  return can(actor, "tasks.assign") && canEditTask(viewer, task);
}
