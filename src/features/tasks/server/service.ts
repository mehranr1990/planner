import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { CONFLICT, NOT_FOUND } from "@/lib/action-result";
import { fromDbDate, localMinutes, todayIn, toDbDate, weekday, type CalendarDate } from "@/lib/time";
import { recordActivity } from "@/server/activity";
import { db, type Tx } from "@/server/db";
import { DomainError } from "@/server/errors";
import { actorIn, type Viewer } from "@/server/context";
import { notify, notifyMany } from "@/server/notifications";
import { can } from "@/server/permissions/capabilities";
import { findVisibleLabel } from "@/features/labels/server/access";
import { canAddTasksToProject, findVisibleProject } from "@/features/projects/server/access";
import { wouldCreateCycle } from "../domain/dependencies";
import { isPlannerView } from "../domain/planner-views";
import { parseQuickAdd } from "../domain/quick-add";
import { nextOccurrence, type RecurrenceRule } from "../domain/recurrence";
import { normalizeSchedule, ScheduleError } from "../domain/schedule";
import type { RecurrencePreset } from "../types";
import type { UpdateTaskInput } from "../schemas";
import { canAssignTask, canDeleteTask, canEditTask, findVisibleTask, taskNotifiableRecipients, visibleTasksWhere } from "./access";
import { createTask } from "./create";

export { DomainError };

interface TaskScope {
  scope: "PERSONAL" | "WORKSPACE";
  workspaceId: string | null;
}

async function resolveScope(viewer: Viewer, context: string, projectId: string | null): Promise<TaskScope & { projectId: string | null }> {
  if (projectId) {
    const project = await findVisibleProject(viewer, projectId);
    if (!project || !canAddTasksToProject(viewer, project)) throw new DomainError(NOT_FOUND);
    // The project decides the scope; a client-supplied context can't move a task elsewhere.
    return { scope: project.scope, workspaceId: project.workspaceId, projectId };
  }
  if (context === "personal") return { scope: "PERSONAL", workspaceId: null, projectId: null };
  const actor = actorIn(viewer, context);
  if (!can(actor, "tasks.create")) throw new DomainError("cannotCreateTasksHere");
  return { scope: "WORKSPACE", workspaceId: context, projectId: null };
}

// ───────────────────────── Create ─────────────────────────

export async function createTaskFromQuickAdd(
  viewer: Viewer,
  input: { input: string; clientMutationId: string; context: string; projectId: string | null; view: string | null },
) {
  const tz = viewer.user.timezone;
  const today = todayIn(tz);
  const parsed = parseQuickAdd(input.input, today);
  if (!parsed.title) throw new DomainError("titleMissingAfterParse");

  const view = input.view && isPlannerView(input.view) ? input.view : null;
  let dueOn = parsed.dueOn;
  let isSomeday = parsed.isSomeday;
  if (!dueOn && !isSomeday && view === "today") dueOn = today;
  if (!dueOn && view === "someday") isSomeday = true;

  const scope = await resolveScope(viewer, input.context, input.projectId);
  let schedule;
  try {
    schedule = normalizeSchedule({ dueOn, dueTime: parsed.dueTime, timezone: tz });
  } catch (e) {
    if (e instanceof ScheduleError) throw new DomainError(e.code);
    throw e;
  }

  const me = viewer.user.id;
  // parse → normalize (above) → shared core. The core resolves double submits via the
  // (creator, clientMutationId) key without failing the transaction.
  const result = await db.$transaction((tx) =>
    createTask(tx, {
      source: { kind: input.projectId ? "PROJECT" : "QUICK_ADD" },
      scope: { scope: scope.scope, workspaceId: scope.workspaceId },
      projectId: scope.projectId,
      ownerId: me,
      createdById: me,
      title: parsed.title,
      priority: parsed.priority ?? "NONE",
      isSomeday,
      schedule,
      clientMutationId: input.clientMutationId,
    }),
  );
  return { id: result.id, deduplicated: !result.created };
}

// ───────────────────────── Load for mutation ─────────────────────────

async function loadEditable(viewer: Viewer, taskId: string) {
  const task = await findVisibleTask(viewer, taskId);
  if (!task || !canEditTask(viewer, task)) throw new DomainError(NOT_FOUND);
  return task;
}

/** Bumps the version only if nobody else changed the task since `expectedVersion`. */
async function guardedUpdate(tx: Tx, taskId: string, expectedVersion: number, data: Prisma.TaskUncheckedUpdateManyInput) {
  const res = await tx.task.updateMany({
    where: { id: taskId, version: expectedVersion, deletedAt: null },
    data: { ...data, version: { increment: 1 } },
  });
  if (res.count === 0) throw new DomainError(CONFLICT);
}

// ───────────────────────── Update ─────────────────────────

/**
 * Watcher-policy events (§8): status and due-date changes are meaningful enough to notify
 * owner/assignees/watchers (deduped, actor excluded) — everything else (title, description,
 * priority, estimate, someday, project moves) is recorded as plain activity only, no
 * notification, so editing a task doesn't spam its watchers over every minor field.
 */
export async function updateTask(viewer: Viewer, input: UpdateTaskInput) {
  const task = await loadEditable(viewer, input.taskId);
  const current = await db.task.findUniqueOrThrow({
    where: { id: task.id },
    select: { status: true, dueOn: true, dueAt: true, isAllDay: true, timezone: true, projectId: true },
  });
  if (input.status === "DONE") throw new DomainError("useComplete"); // completion has side effects (recurrence)
  const data: Prisma.TaskUncheckedUpdateManyInput = {};
  const fieldChanges: string[] = [];
  let statusChange: { from: string; to: string } | null = null;
  let scheduleChanged = false;

  if (input.title !== undefined) {
    data.title = input.title;
    fieldChanges.push("title");
  }
  if (input.description !== undefined) {
    data.description = input.description?.trim() || null;
    fieldChanges.push("description");
  }
  if (input.priority !== undefined) {
    data.priority = input.priority;
    fieldChanges.push("priority");
  }
  if (input.estimateMinutes !== undefined) data.estimateMinutes = input.estimateMinutes;
  if (input.isSomeday !== undefined) {
    data.isSomeday = input.isSomeday;
    fieldChanges.push(input.isSomeday ? "parked" : "unparked");
  }
  if (input.status !== undefined && input.status !== current.status) {
    data.status = input.status;
    statusChange = { from: current.status, to: input.status };
  }

  if (input.dueOn !== undefined || input.dueTime !== undefined) {
    const tz = viewer.user.timezone;
    const dueOn = input.dueOn !== undefined ? input.dueOn : current.dueOn ? fromDbDate(current.dueOn) : null;
    const keepTime = input.dueTime === undefined && !current.isAllDay && current.dueAt;
    const dueTime = input.dueTime !== undefined ? input.dueTime : keepTime ? localMinutes(current.dueAt!, current.timezone ?? tz) : null;
    try {
      const s = normalizeSchedule({ dueOn, dueTime: dueOn ? dueTime : null, timezone: current.timezone ?? tz });
      data.isAllDay = s.isAllDay;
      data.timezone = s.timezone;
      data.dueOn = s.dueOn ? toDbDate(s.dueOn) : null;
      data.dueAt = s.dueAt;
      if (s.dueOn) data.isSomeday = false; // a dated task is no longer parked
      scheduleChanged = (data.dueOn as Date | null)?.getTime() !== current.dueOn?.getTime() || (data.dueAt as Date | null)?.getTime() !== current.dueAt?.getTime();
    } catch (e) {
      if (e instanceof ScheduleError) throw new DomainError(e.code);
      throw e;
    }
  }

  if (input.projectId !== undefined && input.projectId !== current.projectId) {
    if (input.projectId) {
      const project = await findVisibleProject(viewer, input.projectId);
      if (!project || !canAddTasksToProject(viewer, project)) throw new DomainError(NOT_FOUND);
      // Moving across scopes would silently change who can see the task.
      if (project.workspaceId !== task.workspaceId) throw new DomainError("projectOtherSpace");
    }
    data.projectId = input.projectId;
    data.sectionId = null;
    fieldChanges.push("project");
  }

  const newVersion = input.expectedVersion + 1;
  const recipients = taskNotifiableRecipients(task, viewer.user.id);

  await db.$transaction(async (tx) => {
    await guardedUpdate(tx, task.id, input.expectedVersion, data);
    if (fieldChanges.length > 0) {
      await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: task.id, action: "updated", data: { fields: fieldChanges } });
    }
    if (statusChange) {
      await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: task.id, action: "status_changed", data: statusChange });
      await notifyMany(tx, recipients, {
        workspaceId: task.workspaceId,
        actorId: viewer.user.id,
        type: "TASK_STATUS_CHANGED",
        entityType: "task",
        entityId: task.id,
        title: task.title,
        deepLink: `/planner/all?task=${task.id}`,
        dedupeKeyFor: (userId) => `task:${task.id}:v${newVersion}:status:${userId}`,
      });
    }
    if (scheduleChanged) {
      await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: task.id, action: "schedule_changed" });
      await notifyMany(tx, recipients, {
        workspaceId: task.workspaceId,
        actorId: viewer.user.id,
        type: "TASK_DUE_DATE_CHANGED",
        entityType: "task",
        entityId: task.id,
        title: task.title,
        deepLink: `/planner/all?task=${task.id}`,
        dedupeKeyFor: (userId) => `task:${task.id}:v${newVersion}:schedule:${userId}`,
      });
    }
  });
}

// ───────────────────────── Completion & recurrence ─────────────────────────

function ruleFromSeries(series: {
  frequency: RecurrenceRule["frequency"];
  interval: number;
  byWeekday: number[];
  byMonthDay: number[];
  mode: RecurrenceRule["mode"];
  startsOn: Date;
  untilOn: Date | null;
  maxCount: number | null;
}): RecurrenceRule {
  return {
    frequency: series.frequency,
    interval: series.interval,
    byWeekday: series.byWeekday,
    byMonthDay: series.byMonthDay,
    mode: series.mode,
    startsOn: fromDbDate(series.startsOn),
    untilOn: series.untilOn ? fromDbDate(series.untilOn) : null,
    maxCount: series.maxCount,
  };
}

/**
 * Generates the occurrence after `task` if `task` is the series' latest occurrence.
 * Safe to call repeatedly: re-completing an older occurrence does nothing, and the
 * (seriesId, occurrenceOn) unique key makes concurrent generation collapse to one row.
 */
async function generateNextOccurrence(tx: Tx, taskId: string, actorId: string) {
  const task = await tx.task.findUniqueOrThrow({
    where: { id: taskId },
    select: {
      seriesId: true, occurrenceOn: true, scope: true, workspaceId: true, ownerId: true, projectId: true, sectionId: true,
      areaId: true, title: true, description: true, priority: true, estimateMinutes: true,
      assignees: { select: { userId: true, assignedById: true } },
      labels: { select: { labelId: true } },
    },
  });
  if (!task.seriesId || !task.occurrenceOn) return null;
  const series = await tx.recurrenceSeries.findUnique({ where: { id: task.seriesId } });
  if (!series || series.endedAt) return null;
  if (!series.lastOccurrenceOn || series.lastOccurrenceOn.getTime() !== task.occurrenceOn.getTime()) return null;

  const next = nextOccurrence(ruleFromSeries(series), {
    lastOccurrenceOn: fromDbDate(task.occurrenceOn),
    generatedCount: series.generatedCount,
    completedOn: todayIn(series.timezone),
  });
  if (!next) {
    await tx.recurrenceSeries.update({ where: { id: series.id }, data: { endedAt: new Date() } });
    return null;
  }

  // next occurrence (above) → normalize → shared core. The just-completed occurrence is the
  // template, so edits made to the series carry forward; assignees and labels are copied.
  const schedule = normalizeSchedule({ dueOn: next, dueTime: series.timeOfDay, timezone: series.timezone });
  const result = await createTask(tx, {
    source: { kind: "RECURRENCE", ref: { type: "task", id: taskId } },
    scope: { scope: task.scope, workspaceId: task.workspaceId },
    projectId: task.projectId,
    sectionId: task.sectionId,
    areaId: task.areaId,
    ownerId: task.ownerId,
    createdById: actorId,
    title: task.title,
    description: task.description,
    priority: task.priority,
    estimateMinutes: task.estimateMinutes,
    schedule,
    occurrence: { seriesId: series.id, occurrenceOn: next },
    assignees: task.assignees,
    labelIds: task.labels.map((l) => l.labelId),
  });
  if (!result.created) return null; // another request generated it first

  await tx.recurrenceSeries.update({
    where: { id: series.id },
    data: { generatedCount: { increment: 1 }, lastOccurrenceOn: toDbDate(next) },
  });
  return result.id;
}

/**
 * Completing a task clears its own pending (undelivered) reminders — nobody needs reminding
 * about a task that's already done — and, for each task it blocks whose *other* blockers are
 * all already resolved, notifies that task's owner/assignees/watchers that it's now unblocked
 * (the one dependency event judged worth a notification: "you can start this now" is actionable,
 * "a dependency was added" is not). Reopening a task does not resurrect its cleared reminders —
 * the user re-adds one if they still want it (see docs/HANDOFF.md for the full policy table).
 */
export async function setTaskCompletion(viewer: Viewer, taskId: string, done: boolean) {
  const task = await loadEditable(viewer, taskId);
  const isDone = task.status === "DONE";
  if (done === isDone) return { nextOccurrenceId: null }; // idempotent toggle
  const newVersion = task.version + 1;
  const recipients = taskNotifiableRecipients(task, viewer.user.id);

  return db.$transaction(async (tx) => {
    await guardedUpdate(
      tx,
      task.id,
      task.version,
      done
        ? { status: "DONE", completedAt: new Date(), completedById: viewer.user.id }
        : { status: "TODO", completedAt: null, completedById: null },
    );
    await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: task.id, action: done ? "completed" : "reopened" });
    await notifyMany(tx, recipients, {
      workspaceId: task.workspaceId,
      actorId: viewer.user.id,
      type: "TASK_STATUS_CHANGED",
      entityType: "task",
      entityId: task.id,
      title: task.title,
      deepLink: `/planner/all?task=${task.id}`,
      dedupeKeyFor: (userId) => `task:${task.id}:v${newVersion}:status:${userId}`,
    });

    let nextOccurrenceId: string | null = null;
    if (done) {
      await tx.reminder.deleteMany({ where: { taskId: task.id, deliveredAt: null } });
      nextOccurrenceId = await generateNextOccurrence(tx, task.id, viewer.user.id);
      await notifyUnblockedByCompleting(tx, task.id, newVersion, viewer.user.id);
    }
    return { nextOccurrenceId };
  });
}

/** For each task this one blocks, notify its stakeholders once none of its *other* blockers remain open. */
async function notifyUnblockedByCompleting(tx: Tx, completedTaskId: string, completedTaskVersion: number, actorId: string) {
  const blocks = await tx.taskDependency.findMany({ where: { blockingTaskId: completedTaskId }, select: { blockedTaskId: true } });
  for (const { blockedTaskId } of blocks) {
    const stillBlocked = await tx.taskDependency.count({
      where: { blockedTaskId, blockingTaskId: { not: completedTaskId }, blockingTask: { status: { notIn: ["DONE", "CANCELLED"] } } },
    });
    if (stillBlocked > 0) continue;
    const blockedTask = await tx.task.findUnique({
      where: { id: blockedTaskId },
      select: { title: true, workspaceId: true, ownerId: true, assignees: { select: { userId: true } }, watchers: { select: { userId: true } } },
    });
    if (!blockedTask) continue;
    const recipients = taskNotifiableRecipients(blockedTask, actorId);
    await notifyMany(tx, recipients, {
      workspaceId: blockedTask.workspaceId,
      actorId,
      type: "TASK_UNBLOCKED",
      entityType: "task",
      entityId: blockedTaskId,
      title: blockedTask.title,
      deepLink: `/planner/all?task=${blockedTaskId}`,
      dedupeKeyFor: (userId) => `task:${completedTaskId}:v${completedTaskVersion}:unblocks:${blockedTaskId}:${userId}`,
    });
  }
}

const PRESET_RULES: Record<Exclude<RecurrencePreset, "none">, (anchor: CalendarDate) => Pick<RecurrenceRule, "frequency" | "byWeekday" | "byMonthDay">> = {
  daily: () => ({ frequency: "DAILY", byWeekday: [], byMonthDay: [] }),
  weekdays: () => ({ frequency: "WEEKLY", byWeekday: [1, 2, 3, 4, 5], byMonthDay: [] }),
  weekly: (a) => ({ frequency: "WEEKLY", byWeekday: [weekday(a)], byMonthDay: [] }),
  monthly: (a) => ({ frequency: "MONTHLY", byWeekday: [], byMonthDay: [Number(a.slice(8, 10))] }),
  yearly: () => ({ frequency: "YEARLY", byWeekday: [], byMonthDay: [] }),
};

export async function setTaskRecurrence(viewer: Viewer, taskId: string, preset: RecurrencePreset, mode: RecurrenceRule["mode"]) {
  const task = await loadEditable(viewer, taskId);
  const row = await db.task.findUniqueOrThrow({
    where: { id: task.id },
    select: { dueOn: true, dueAt: true, isAllDay: true, timezone: true, title: true, seriesId: true },
  });

  await db.$transaction(async (tx) => {
    // Changing or removing a rule ends the old series; its past occurrences keep their link.
    if (row.seriesId) {
      await tx.recurrenceSeries.updateMany({ where: { id: row.seriesId, endedAt: null }, data: { endedAt: new Date() } });
    }
    if (preset === "none") {
      if (row.seriesId) await tx.task.update({ where: { id: task.id }, data: { seriesId: null, occurrenceOn: null } });
      await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: task.id, action: "recurrence_removed" });
      return;
    }
    if (!row.dueOn) throw new DomainError("recurrenceNeedsDueDate");
    const anchor = fromDbDate(row.dueOn);
    const tz = row.timezone ?? viewer.user.timezone;
    const shape = PRESET_RULES[preset](anchor);
    const series = await tx.recurrenceSeries.create({
      data: {
        scope: task.scope,
        workspaceId: task.workspaceId,
        ownerId: task.ownerId,
        frequency: shape.frequency,
        byWeekday: [...shape.byWeekday],
        byMonthDay: [...shape.byMonthDay],
        interval: 1,
        mode,
        timezone: tz,
        startsOn: row.dueOn,
        timeOfDay: !row.isAllDay && row.dueAt ? localMinutes(row.dueAt, tz) : null,
        template: { title: row.title },
        generatedCount: 1,
        lastOccurrenceOn: row.dueOn,
      },
      select: { id: true },
    });
    await tx.task.update({ where: { id: task.id }, data: { seriesId: series.id, occurrenceOn: row.dueOn } });
    await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: task.id, action: "recurrence_set", data: { preset, mode } });
  });
}

// ───────────────────────── Delete / archive ─────────────────────────

export async function softDeleteTask(viewer: Viewer, taskId: string) {
  const task = await findVisibleTask(viewer, taskId);
  if (!task || !canDeleteTask(viewer, task)) throw new DomainError(NOT_FOUND);
  await db.$transaction(async (tx) => {
    const now = new Date();
    // Subtasks go with their parent; both remain restorable.
    await tx.task.updateMany({ where: { OR: [{ id: task.id }, { parentId: task.id }], deletedAt: null }, data: { deletedAt: now, version: { increment: 1 } } });
    await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: task.id, action: "deleted" });
  });
}

export async function restoreTask(viewer: Viewer, taskId: string) {
  const me = viewer.user.id;
  // Deleted tasks are invisible to visibleTasksWhere, so look them up with the same scope rules minus deletedAt.
  const where = visibleTasksWhere(viewer);
  const task = await db.task.findFirst({
    where: { id: taskId, deletedAt: { not: null }, OR: where.OR },
    select: { id: true, workspaceId: true, scope: true, ownerId: true, createdById: true, deletedAt: true },
  });
  if (!task) throw new DomainError(NOT_FOUND);
  const allowed =
    task.scope === "PERSONAL" ? task.ownerId === me : task.createdById === me || can(actorIn(viewer, task.workspaceId ?? ""), "tasks.delete");
  if (!allowed) throw new DomainError(NOT_FOUND);
  await db.$transaction(async (tx) => {
    await tx.task.updateMany({ where: { OR: [{ id: task.id }, { parentId: task.id }], deletedAt: task.deletedAt }, data: { deletedAt: null, version: { increment: 1 } } });
    await recordActivity(tx, { workspaceId: task.workspaceId, actorId: me, entityType: "task", entityId: task.id, action: "restored" });
  });
}

// ───────────────────────── Dependencies ─────────────────────────

const MAX_DEPENDENCY_DEPTH = 500;

export async function addDependency(viewer: Viewer, blockingTaskId: string, blockedTaskId: string) {
  const [blocking, blocked] = await Promise.all([findVisibleTask(viewer, blockingTaskId), findVisibleTask(viewer, blockedTaskId)]);
  if (!blocking || !blocked || !canEditTask(viewer, blocked)) throw new DomainError(NOT_FOUND);
  if (blocking.workspaceId !== blocked.workspaceId) throw new DomainError("dependencyOtherSpace");

  // Walk everything downstream of `blocked`; if `blocking` is reachable, the edge closes a loop.
  const edges: { blockingTaskId: string; blockedTaskId: string }[] = [];
  let frontier = [blockedTaskId];
  const seen = new Set(frontier);
  while (frontier.length > 0 && seen.size < MAX_DEPENDENCY_DEPTH) {
    const level = await db.taskDependency.findMany({ where: { blockingTaskId: { in: frontier } }, select: { blockingTaskId: true, blockedTaskId: true } });
    edges.push(...level);
    frontier = level.map((e) => e.blockedTaskId).filter((id) => !seen.has(id));
    frontier.forEach((id) => seen.add(id));
  }
  if (wouldCreateCycle(edges, blockingTaskId, blockedTaskId)) throw new DomainError("dependencyCycle");

  await db.$transaction(async (tx) => {
    await tx.taskDependency.upsert({
      where: { blockingTaskId_blockedTaskId: { blockingTaskId, blockedTaskId } },
      create: { blockingTaskId, blockedTaskId, createdById: viewer.user.id },
      update: {},
    });
    await recordActivity(tx, { workspaceId: blocked.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: blockedTaskId, action: "dependency_added", data: { blockingTaskId } });
  });
}

/** Same permission shape as `addDependency`: editing a dependency is gated on the blocked side. */
export async function removeDependency(viewer: Viewer, blockingTaskId: string, blockedTaskId: string) {
  const blocked = await findVisibleTask(viewer, blockedTaskId);
  if (!blocked || !canEditTask(viewer, blocked)) throw new DomainError(NOT_FOUND);

  await db.$transaction(async (tx) => {
    const res = await tx.taskDependency.deleteMany({ where: { blockingTaskId, blockedTaskId } });
    if (res.count > 0) {
      await recordActivity(tx, { workspaceId: blocked.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: blockedTaskId, action: "dependency_removed", data: { blockingTaskId } });
    }
  });
}

// ───────────────────────── Assignees ─────────────────────────

/**
 * Replaces the task's assignee set in one call (diffed server-side), matching how `PeoplePicker`
 * hands back the full next selection. Notifies only newly-added assignees, never on
 * self-assignment or removal.
 */
export async function setTaskAssignees(viewer: Viewer, taskId: string, userIds: string[]) {
  const task = await findVisibleTask(viewer, taskId);
  if (!task || !canAssignTask(viewer, task)) throw new DomainError(NOT_FOUND);

  const uniqueIds = [...new Set(userIds)];
  if (task.scope === "PERSONAL") {
    if (uniqueIds.length > 0) throw new DomainError(NOT_FOUND); // personal tasks have nobody else to assign
  } else if (uniqueIds.length > 0) {
    const members = await db.membership.count({ where: { workspaceId: task.workspaceId ?? "", userId: { in: uniqueIds }, status: "ACTIVE" } });
    if (members !== uniqueIds.length) throw new DomainError(NOT_FOUND); // someone isn't an active member
  }

  const current = new Set(task.assignees.map((a) => a.userId));
  const next = new Set(uniqueIds);
  const added = uniqueIds.filter((id) => !current.has(id));
  const removed = [...current].filter((id) => !next.has(id));
  if (added.length === 0 && removed.length === 0) return;

  await db.$transaction(async (tx) => {
    if (removed.length) await tx.taskAssignee.deleteMany({ where: { taskId, userId: { in: removed } } });
    if (added.length) await tx.taskAssignee.createMany({ data: added.map((userId) => ({ taskId, userId, assignedById: viewer.user.id })) });
    await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: taskId, action: "assignees_changed", data: { added, removed } });
    for (const userId of added) {
      if (userId === viewer.user.id) continue;
      await notify(tx, {
        recipientId: userId,
        workspaceId: task.workspaceId,
        actorId: viewer.user.id,
        type: "TASK_ASSIGNED",
        entityType: "task",
        entityId: taskId,
        title: task.title,
        deepLink: `/planner/all?task=${taskId}`,
        dedupeKey: `task:${taskId}:assigned:${userId}`,
      });
    }
  });
}

// ───────────────────────── Watchers ─────────────────────────

/** Watching is self-service: anyone who can see the task may follow it; nobody watches on another's behalf. */
export async function watchTask(viewer: Viewer, taskId: string) {
  const task = await findVisibleTask(viewer, taskId);
  if (!task) throw new DomainError(NOT_FOUND);
  await db.$transaction(async (tx) => {
    const res = await tx.taskWatcher.createMany({ data: [{ taskId, userId: viewer.user.id }], skipDuplicates: true });
    if (res.count > 0) await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: taskId, action: "watching" });
  });
}

export async function unwatchTask(viewer: Viewer, taskId: string) {
  const task = await findVisibleTask(viewer, taskId);
  if (!task) throw new DomainError(NOT_FOUND);
  await db.$transaction(async (tx) => {
    const res = await tx.taskWatcher.deleteMany({ where: { taskId, userId: viewer.user.id } });
    if (res.count > 0) await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: taskId, action: "unwatching" });
  });
}

// ───────────────────────── Subtasks ─────────────────────────

/** One level of nesting only (keeps the UI sane); goes through the shared `createTask` core (§91). */
export async function createSubtask(viewer: Viewer, parentTaskId: string, title: string) {
  const parent = await loadEditable(viewer, parentTaskId);
  if (parent.parentId) throw new DomainError("subtaskTooDeep");
  const current = await db.task.findUniqueOrThrow({
    where: { id: parent.id },
    select: { projectId: true, sectionId: true, areaId: true, timezone: true },
  });
  const schedule = normalizeSchedule({ dueOn: null, dueTime: null, timezone: current.timezone ?? viewer.user.timezone });

  return db.$transaction(async (tx) => {
    const result = await createTask(tx, {
      source: { kind: "SUBTASK", ref: { type: "task", id: parent.id } },
      scope: { scope: parent.scope, workspaceId: parent.workspaceId },
      projectId: current.projectId,
      sectionId: current.sectionId,
      areaId: current.areaId,
      parentId: parent.id,
      ownerId: parent.ownerId,
      createdById: viewer.user.id,
      title,
      schedule,
    });
    if (result.created) {
      await recordActivity(tx, { workspaceId: parent.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: parent.id, action: "subtask_created", data: { subtaskId: result.id } });
    }
    return result;
  });
}

// ───────────────────────── Labels ─────────────────────────

/** Replaces the task's label set in one call, diffed server-side (same shape as `setTaskAssignees`). */
export async function setTaskLabels(viewer: Viewer, taskId: string, labelIds: string[]) {
  const task = await loadEditable(viewer, taskId);
  const uniqueIds = [...new Set(labelIds)];
  if (uniqueIds.length > 0) {
    const labels = await Promise.all(uniqueIds.map((id) => findVisibleLabel(viewer, id)));
    const valid = labels.every(
      (l) =>
        l &&
        !l.archivedAt &&
        l.scope === task.scope &&
        (task.scope === "PERSONAL" ? l.ownerId === viewer.user.id : l.workspaceId === task.workspaceId),
    );
    if (!valid) throw new DomainError(NOT_FOUND);
  }

  const current = await db.taskLabel.findMany({ where: { taskId }, select: { labelId: true } });
  const currentIds = new Set(current.map((l) => l.labelId));
  const nextIds = new Set(uniqueIds);
  const added = uniqueIds.filter((id) => !currentIds.has(id));
  const removed = [...currentIds].filter((id) => !nextIds.has(id));
  if (added.length === 0 && removed.length === 0) return;

  await db.$transaction(async (tx) => {
    if (removed.length) await tx.taskLabel.deleteMany({ where: { taskId, labelId: { in: removed } } });
    if (added.length) await tx.taskLabel.createMany({ data: added.map((labelId) => ({ taskId, labelId })) });
    await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: taskId, action: "labels_changed", data: { added, removed } });
  });
}

// ───────────────────────── Checklist ─────────────────────────

export async function addChecklistItem(viewer: Viewer, taskId: string, title: string) {
  const task = await loadEditable(viewer, taskId);
  const last = await db.checklistItem.findFirst({ where: { taskId: task.id }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  await db.checklistItem.create({ data: { taskId: task.id, title, sortOrder: (last?.sortOrder ?? 0) + 1 } });
}

export async function toggleChecklistItem(viewer: Viewer, itemId: string, isDone: boolean) {
  const item = await db.checklistItem.findUnique({ where: { id: itemId }, select: { taskId: true } });
  if (!item) throw new DomainError(NOT_FOUND);
  await loadEditable(viewer, item.taskId);
  await db.checklistItem.update({ where: { id: itemId }, data: { isDone, completedAt: isDone ? new Date() : null } });
}
