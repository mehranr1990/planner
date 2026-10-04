import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { fromDbDate, localMinutes, todayIn, toDbDate, type CalendarDate } from "@/lib/time";
import { db } from "@/server/db";
import type { Viewer } from "@/server/context";
import { listLabels } from "@/features/labels/server/queries";
import { listMembers } from "@/features/workspace/server/queries";
import type { PlannerScopeFilter, PlannerView } from "../domain/planner-views";
import { OPEN_STATUSES, type RecurrenceDisplay, type TaskDetail, type TaskListItem } from "../types";
import { canAssignTask, canDeleteTask, canEditTask, findVisibleTask, visibleTasksWhere } from "./access";
import { ownershipWhere, plannerFiltersWhere, resolveOwnership, type PlannerFilters } from "./filters";

/** Workspace members selectable as assignees for the open task's sheet; empty for personal tasks. */
export async function getAssignableMembers(viewer: Viewer, detail: TaskDetail | null) {
  if (!detail || detail.context.kind !== "workspace") return [];
  const members = await listMembers(viewer, detail.context.id);
  return members?.map((m) => m.user) ?? [];
}

/** Labels usable on the open task's own scope (that workspace, or the viewer's personal labels). */
export async function getTaskLabelOptions(viewer: Viewer, detail: TaskDetail | null) {
  if (!detail) return [];
  return listLabels(viewer, detail.context.kind === "workspace" ? { scope: "WORKSPACE", workspaceId: detail.context.id } : { scope: "PERSONAL" });
}

const listSelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  isAllDay: true,
  dueOn: true,
  dueAt: true,
  isSomeday: true,
  seriesId: true,
  completedAt: true,
  version: true,
  scope: true,
  workspaceId: true,
  ownerId: true,
  createdById: true,
  occurrenceOn: true,
  parentId: true,
  workspace: { select: { id: true, name: true } },
  project: { select: { id: true, name: true, color: true, ownerId: true, visibility: true, members: { select: { userId: true, role: true } } } },
  // Stable preview order (first assigned first) so faces don't reshuffle between renders.
  assignees: { select: { userId: true, user: { select: { id: true, name: true, avatarUrl: true } } }, orderBy: [{ assignedAt: "asc" }, { userId: "asc" }], take: 4 },
  watchers: { select: { userId: true } },
  labels: { select: { label: { select: { id: true, name: true, color: true } } }, orderBy: { label: { name: "asc" } } },
  checklist: { select: { isDone: true } },
  _count: { select: { subtasks: { where: { deletedAt: null } }, assignees: true } },
} satisfies Prisma.TaskSelect;

type ListRow = Prisma.TaskGetPayload<{ select: typeof listSelect }>;

function toListItem(viewer: Viewer, row: ListRow, now = new Date()): TaskListItem {
  const open = (OPEN_STATUSES as readonly string[]).includes(row.status);
  const today = toDbDate(todayIn(viewer.user.timezone, now));
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    isAllDay: row.isAllDay,
    dueOn: row.dueOn ? fromDbDate(row.dueOn) : null,
    dueAt: row.dueAt?.toISOString() ?? null,
    isSomeday: row.isSomeday,
    isOverdue: open && ((row.dueOn !== null && row.dueOn < today) || (row.dueAt !== null && row.dueAt < now)),
    isRecurring: row.seriesId !== null,
    completedAt: row.completedAt?.toISOString() ?? null,
    version: row.version,
    context: row.workspace ? { kind: "workspace", id: row.workspace.id, name: row.workspace.name } : { kind: "personal" },
    project: row.project ? { id: row.project.id, name: row.project.name, color: row.project.color } : null,
    assignees: row.assignees.map((a) => a.user),
    assigneeCount: row._count.assignees,
    subtaskCount: row._count.subtasks,
    checklist: { done: row.checklist.filter((c) => c.isDone).length, total: row.checklist.length },
    labels: row.labels.map((l) => l.label),
    canEdit: canEditTask(viewer, row),
  };
}

function scopeWhere(filter: PlannerScopeFilter): Prisma.TaskWhereInput {
  switch (filter.kind) {
    case "all":
      return {};
    case "personal":
      return { scope: "PERSONAL" };
    case "workspace":
      return { workspaceId: filter.workspaceId };
  }
}

export function viewWhere(view: PlannerView, today: CalendarDate, now: Date): Prisma.TaskWhereInput {
  const open: Prisma.TaskWhereInput = { status: { in: [...OPEN_STATUSES] }, archivedAt: null };
  const t = toDbDate(today);
  switch (view) {
    case "inbox":
      return { ...open, projectId: null, dueOn: null, startOn: null, isSomeday: false };
    case "today":
      return { ...open, OR: [{ dueOn: { lte: t } }, { startOn: { lte: t } }] };
    case "upcoming":
      return { ...open, OR: [{ dueOn: { gt: t } }, { dueOn: null, startOn: { gt: t } }] };
    case "overdue":
      return { ...open, OR: [{ dueOn: { lt: t } }, { dueAt: { lt: now } }] };
    case "scheduled":
      return { ...open, dueOn: { not: null } };
    case "someday":
      return { ...open, isSomeday: true };
    case "completed":
      return { status: "DONE" };
    case "all":
      return { archivedAt: null };
    case "delegated":
      return open;
  }
}

function viewOrder(view: PlannerView): Prisma.TaskOrderByWithRelationInput[] {
  if (view === "completed") return [{ completedAt: "desc" }];
  if (view === "inbox" || view === "someday" || view === "all") return [{ sortOrder: "asc" }, { createdAt: "desc" }];
  return [{ dueOn: { sort: "asc", nulls: "last" } }, { dueAt: { sort: "asc", nulls: "last" } }, { priority: "desc" }, { createdAt: "asc" }];
}

const VIEW_LIMIT = 200;

/** `filters` (advanced filters, Batch 4) default to none, so every existing call site and every
 * view's semantics/speed are unchanged unless the caller actually has an active filter. */
export async function getPlannerTasks(viewer: Viewer, view: PlannerView, filter: PlannerScopeFilter, filters: PlannerFilters = {}) {
  const now = new Date();
  const today = todayIn(viewer.user.timezone, now);
  const rows = await db.task.findMany({
    where: {
      AND: [
        visibleTasksWhere(viewer),
        resolveOwnership(viewer, view, filters),
        scopeWhere(filter),
        viewWhere(view, today, now),
        { parentId: null },
        ...plannerFiltersWhere(viewer, filters),
      ],
    },
    orderBy: viewOrder(view),
    select: listSelect,
    take: VIEW_LIMIT + 1,
  });
  return { today, tasks: rows.slice(0, VIEW_LIMIT).map((r) => toListItem(viewer, r)), truncated: rows.length > VIEW_LIMIT };
}

export async function getPlannerCounts(viewer: Viewer, filter: PlannerScopeFilter) {
  const now = new Date();
  const today = todayIn(viewer.user.timezone, now);
  const base = [visibleTasksWhere(viewer), scopeWhere(filter), { parentId: null }];
  const count = (view: PlannerView) => db.task.count({ where: { AND: [...base, ownershipWhere(viewer, view), viewWhere(view, today, now)] } });
  const [inbox, todayCount, overdue, delegated] = await Promise.all([count("inbox"), count("today"), count("overdue"), count("delegated")]);
  return { inbox, today: todayCount, overdue, delegated };
}

export async function getProjectTasks(viewer: Viewer, projectId: string, includeDone: boolean) {
  const rows = await db.task.findMany({
    where: {
      AND: [
        visibleTasksWhere(viewer),
        { projectId, parentId: null, archivedAt: null },
        includeDone ? {} : { status: { in: [...OPEN_STATUSES] } },
      ],
    },
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    select: listSelect,
    take: 500,
  });
  return rows.map((r) => toListItem(viewer, r));
}

function presetOf(series: { frequency: string; interval: number; byWeekday: number[] }): RecurrenceDisplay {
  if (series.interval !== 1) return "custom";
  if (series.frequency === "WEEKLY" && series.byWeekday.length === 5 && [1, 2, 3, 4, 5].every((d) => series.byWeekday.includes(d))) return "weekdays";
  return ({ DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly", YEARLY: "yearly" } as const)[series.frequency as "DAILY"] ?? "daily";
}

export async function getTaskDetail(viewer: Viewer, taskId: string): Promise<TaskDetail | null> {
  const policy = await findVisibleTask(viewer, taskId);
  if (!policy) return null;
  const row = await db.task.findUniqueOrThrow({
    where: { id: taskId },
    select: {
      ...listSelect,
      description: true,
      estimateMinutes: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      series: { select: { frequency: true, interval: true, byWeekday: true, mode: true, endedAt: true } },
      subtasks: { where: { deletedAt: null }, select: { id: true, title: true, status: true }, orderBy: { sortOrder: "asc" } },
      checklist: { select: { id: true, title: true, isDone: true }, orderBy: { sortOrder: "asc" } },
      watchers: { select: { userId: true } },
      blockedBy: { select: { blockingTask: { select: { id: true, title: true, status: true } } }, orderBy: { createdAt: "asc" } },
      blocking: { select: { blockedTask: { select: { id: true, title: true, status: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  const activity = await db.activity.findMany({
    where: { entityType: "task", entityId: taskId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, action: true, createdAt: true, actor: { select: { id: true, name: true, avatarUrl: true } } },
  });
  const item = toListItem(viewer, row);
  const blockedBy = row.blockedBy.map((d) => d.blockingTask);
  return {
    ...item,
    description: row.description,
    estimateMinutes: row.estimateMinutes,
    dueTime: row.dueAt ? localMinutes(row.dueAt, viewer.user.timezone) : null,
    recurrence: row.series && !row.series.endedAt ? { preset: presetOf(row.series), mode: row.series.mode } : null,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
    canDelete: canDeleteTask(viewer, policy),
    canAssign: canAssignTask(viewer, policy),
    isWatching: row.watchers.some((w) => w.userId === viewer.user.id),
    watcherCount: row.watchers.length,
    subtasks: row.subtasks,
    checklistItems: row.checklist,
    activity: activity.map((a) => ({ id: a.id, action: a.action, actor: a.actor, createdAt: a.createdAt.toISOString() })),
    blockedBy,
    blocking: row.blocking.map((d) => d.blockedTask),
    isBlocked: blockedBy.some((d) => d.status !== "DONE" && d.status !== "CANCELLED"),
  };
}

/** Other visible tasks in the same scope, for the dependency picker's search (excludes itself). */
export async function searchDependencyCandidates(viewer: Viewer, taskId: string, query: string) {
  const task = await findVisibleTask(viewer, taskId);
  const q = query.trim();
  if (!task || !q) return [];
  const rows = await db.task.findMany({
    where: {
      AND: [
        visibleTasksWhere(viewer),
        { id: { not: taskId }, scope: task.scope, workspaceId: task.workspaceId, deletedAt: null, title: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, title: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  return rows;
}
