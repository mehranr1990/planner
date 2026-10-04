import "server-only";
import { randomUUID } from "node:crypto";
import { toDbDate, type CalendarDate } from "@/lib/time";
import { recordActivity } from "@/server/activity";
import { db } from "@/server/db";
import type { Viewer } from "@/server/context";
import { DomainError } from "@/server/errors";
import { BulkNotifyAccumulator } from "@/server/notify-bulk";
import { findVisibleLabel, type LabelPolicyRecord } from "@/features/labels/server/access";
import { canAddTasksToProject, findVisibleProject } from "@/features/projects/server/access";
import { normalizeSchedule, ScheduleError } from "../domain/schedule";
import type { TaskPriority } from "../types";
import { canAssignTask, canDeleteTask, canEditTask, findVisibleTasks, taskNotifiableRecipients, type TaskPolicyRecord } from "./access";
import { completeTaskCore } from "./service";

// Bulk task actions (Batch 4). Every mutation here is PERMISSION-SAFE and BEST-EFFORT/PARTIAL,
// not atomic: each requested task is checked individually (`canEditTask`/`canDeleteTask`), and a
// task the caller may not touch is silently skipped rather than failing the whole batch — chosen
// because COVERAGE_MATRIX.md's PLN-18 row already specifies "edit per item" as the intended
// permission model, and one locked task shouldn't block N legitimate updates. Every function
// returns `{updatedIds, skippedIds}` so the caller can report the partial result (never silent).
//
// Each function opens exactly ONE transaction for the whole allowed subset (no transaction per
// task), and reuses the same mutation cores/permission functions single-task actions use — see
// `completeTaskCore` in service.ts for the clearest example (recurrence/reminder/unblock logic
// lives in exactly one place).

export interface BulkResult {
  updatedIds: string[];
  skippedIds: string[];
}

const MAX_BULK = 200;

function dedupeCap(taskIds: string[]): string[] {
  return [...new Set(taskIds)].slice(0, MAX_BULK);
}

async function loadBulkEditable(viewer: Viewer, taskIds: string[], opts: { forDelete?: boolean } = {}): Promise<{ allowed: TaskPolicyRecord[]; skippedIds: string[] }> {
  const uniqueIds = dedupeCap(taskIds);
  const rows = await findVisibleTasks(viewer, uniqueIds);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const allowed: TaskPolicyRecord[] = [];
  const skippedIds: string[] = [];
  for (const id of uniqueIds) {
    const row = byId.get(id);
    const ok = row && (opts.forDelete ? canDeleteTask(viewer, row) : canEditTask(viewer, row));
    if (ok && row) allowed.push(row);
    else skippedIds.push(id);
  }
  return { allowed, skippedIds };
}

// ───────────────────────── Completion ─────────────────────────

export async function bulkSetCompletion(viewer: Viewer, taskIds: string[], done: boolean): Promise<BulkResult> {
  const { allowed, skippedIds } = await loadBulkEditable(viewer, taskIds);
  const acc = new BulkNotifyAccumulator(randomUUID(), viewer.user.id);
  const updatedIds: string[] = [];
  await db.$transaction(async (tx) => {
    for (const task of allowed) {
      const { events } = await completeTaskCore(tx, viewer, task, done);
      updatedIds.push(task.id);
      for (const e of events) acc.add({ recipientIds: e.recipients, type: e.type, taskId: e.taskId, title: e.title, workspaceId: e.workspaceId });
    }
    await acc.flush(tx);
  });
  return { updatedIds, skippedIds };
}

// ───────────────────────── Priority ─────────────────────────

export async function bulkSetPriority(viewer: Viewer, taskIds: string[], priority: TaskPriority): Promise<BulkResult> {
  const { allowed, skippedIds } = await loadBulkEditable(viewer, taskIds);
  const updatedIds: string[] = [];
  await db.$transaction(async (tx) => {
    for (const task of allowed) {
      await tx.task.updateMany({ where: { id: task.id, deletedAt: null }, data: { priority, version: { increment: 1 } } });
      await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: task.id, action: "updated", data: { fields: ["priority"] } });
      updatedIds.push(task.id);
    }
    // No notification: priority changes never notify watchers, same as a single-task edit.
  });
  return { updatedIds, skippedIds };
}

// ───────────────────────── Due date ─────────────────────────

/** `dueOn: null` clears the due date entirely (and un-parks nothing — someday is untouched by a clear). */
export async function bulkSetDueDate(viewer: Viewer, taskIds: string[], due: { dueOn: CalendarDate | null; dueTime: number | null }): Promise<BulkResult> {
  const { allowed, skippedIds } = await loadBulkEditable(viewer, taskIds);
  // Normalized once against the caller's own timezone — a bulk set applies the same instant to
  // every task, so there is no "keep this task's existing time" merge to replicate per-row.
  let schedule;
  try {
    schedule = normalizeSchedule({ dueOn: due.dueOn, dueTime: due.dueOn ? due.dueTime : null, timezone: viewer.user.timezone });
  } catch (e) {
    if (e instanceof ScheduleError) throw new DomainError(e.code);
    throw e;
  }
  const updatedIds: string[] = [];
  const acc = new BulkNotifyAccumulator(randomUUID(), viewer.user.id);
  await db.$transaction(async (tx) => {
    for (const task of allowed) {
      await tx.task.updateMany({
        where: { id: task.id, deletedAt: null },
        data: {
          isAllDay: schedule.isAllDay,
          timezone: schedule.timezone,
          dueOn: schedule.dueOn ? toDbDate(schedule.dueOn) : null,
          dueAt: schedule.dueAt,
          isSomeday: schedule.dueOn ? false : undefined,
          version: { increment: 1 },
        },
      });
      await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: task.id, action: "schedule_changed" });
      const recipients = taskNotifiableRecipients(task, viewer.user.id);
      if (recipients.length > 0) acc.add({ recipientIds: recipients, type: "TASK_DUE_DATE_CHANGED", taskId: task.id, title: task.title, workspaceId: task.workspaceId });
      updatedIds.push(task.id);
    }
    await acc.flush(tx);
  });
  return { updatedIds, skippedIds };
}

// ───────────────────────── Labels (additive/subtractive — distinct from setTaskLabels' "replace") ─────────────────────────

async function bulkMutateLabels(viewer: Viewer, taskIds: string[], labelIds: string[], mode: "add" | "remove"): Promise<BulkResult> {
  const { allowed, skippedIds } = await loadBulkEditable(viewer, taskIds);
  const uniqueLabelIds = [...new Set(labelIds)];
  // A label is only valid for a task that shares its scope — a label from one workspace can't tag
  // a task in another, same rule `setTaskLabels` enforces per task.
  const labels = await Promise.all(uniqueLabelIds.map((id) => findVisibleLabel(viewer, id)));
  const validLabels = new Map<string, LabelPolicyRecord>(
    uniqueLabelIds
      .map((id, i): [string, LabelPolicyRecord | null] => [id, labels[i]])
      .filter((entry): entry is [string, LabelPolicyRecord] => entry[1] !== null && !entry[1].archivedAt),
  );

  const updatedIds: string[] = [];
  await db.$transaction(async (tx) => {
    for (const task of allowed) {
      const applicable = [...validLabels.entries()]
        .filter(([, l]) => l.scope === task.scope && (task.scope === "PERSONAL" ? l.ownerId === viewer.user.id : l.workspaceId === task.workspaceId))
        .map(([id]) => id);
      if (applicable.length === 0) continue;
      if (mode === "add") await tx.taskLabel.createMany({ data: applicable.map((labelId) => ({ taskId: task.id, labelId })), skipDuplicates: true });
      else await tx.taskLabel.deleteMany({ where: { taskId: task.id, labelId: { in: applicable } } });
      await recordActivity(tx, {
        workspaceId: task.workspaceId,
        actorId: viewer.user.id,
        entityType: "task",
        entityId: task.id,
        action: "labels_changed",
        data: mode === "add" ? { added: applicable, removed: [] } : { added: [], removed: applicable },
      });
      updatedIds.push(task.id);
    }
    // No notification: label changes never notify watchers, same as a single-task edit.
  });
  return { updatedIds, skippedIds };
}

export const bulkAddLabels = (viewer: Viewer, taskIds: string[], labelIds: string[]) => bulkMutateLabels(viewer, taskIds, labelIds, "add");
export const bulkRemoveLabels = (viewer: Viewer, taskIds: string[], labelIds: string[]) => bulkMutateLabels(viewer, taskIds, labelIds, "remove");

// ───────────────────────── Assignees (additive/subtractive — distinct from setTaskAssignees' "replace") ─────────────────────────

async function bulkMutateAssignees(viewer: Viewer, taskIds: string[], userIds: string[], mode: "add" | "remove"): Promise<BulkResult> {
  const { allowed, skippedIds: notEditable } = await loadBulkEditable(viewer, taskIds);
  const uniqueUserIds = [...new Set(userIds)];
  const updatedIds: string[] = [];
  const skippedIds: string[] = [...notEditable];
  const acc = new BulkNotifyAccumulator(randomUUID(), viewer.user.id);

  await db.$transaction(async (tx) => {
    for (const task of allowed) {
      // Personal tasks have nobody else to assign (same rule `setTaskAssignees` enforces) — a
      // task that's otherwise editable but structurally can't take this mutation is still a skip.
      if (task.scope === "PERSONAL" || !canAssignTask(viewer, task)) {
        skippedIds.push(task.id);
        continue;
      }
      let targets = uniqueUserIds;
      if (mode === "add") {
        const members = await tx.membership.count({ where: { workspaceId: task.workspaceId ?? "", userId: { in: uniqueUserIds }, status: "ACTIVE" } });
        if (members !== uniqueUserIds.length) {
          // Some requested user isn't an active member of this task's workspace — only assign the
          // ones who are, rather than skipping the whole task.
          const activeIds = await tx.membership.findMany({
            where: { workspaceId: task.workspaceId ?? "", userId: { in: uniqueUserIds }, status: "ACTIVE" },
            select: { userId: true },
          });
          targets = activeIds.map((m) => m.userId);
        }
        if (targets.length === 0) continue;
        const current = await tx.taskAssignee.findMany({ where: { taskId: task.id }, select: { userId: true } });
        const currentIds = new Set(current.map((a) => a.userId));
        const added = targets.filter((id) => !currentIds.has(id));
        if (added.length === 0) continue;
        await tx.taskAssignee.createMany({ data: added.map((userId) => ({ taskId: task.id, userId, assignedById: viewer.user.id })), skipDuplicates: true });
        await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: task.id, action: "assignees_changed", data: { added, removed: [] } });
        for (const userId of added) {
          if (userId === viewer.user.id) continue;
          acc.add({ recipientIds: [userId], type: "TASK_ASSIGNED", taskId: task.id, title: task.title, workspaceId: task.workspaceId });
        }
      } else {
        const res = await tx.taskAssignee.deleteMany({ where: { taskId: task.id, userId: { in: targets } } });
        if (res.count === 0) continue;
        await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: task.id, action: "assignees_changed", data: { added: [], removed: targets } });
      }
      updatedIds.push(task.id);
    }
    await acc.flush(tx);
  });
  return { updatedIds, skippedIds };
}

export const bulkAddAssignees = (viewer: Viewer, taskIds: string[], userIds: string[]) => bulkMutateAssignees(viewer, taskIds, userIds, "add");
export const bulkRemoveAssignees = (viewer: Viewer, taskIds: string[], userIds: string[]) => bulkMutateAssignees(viewer, taskIds, userIds, "remove");

// ───────────────────────── Move to project ─────────────────────────

/** `projectId: null` moves tasks out of any project. Cross-space moves are rejected per task
 * (same rule `updateTask` enforces for a single task) — a task whose target would change its
 * workspace is skipped, not silently moved. */
export async function bulkMoveToProject(viewer: Viewer, taskIds: string[], projectId: string | null): Promise<BulkResult> {
  const { allowed, skippedIds: notEditable } = await loadBulkEditable(viewer, taskIds);
  const skippedIds: string[] = [...notEditable];
  let project = null;
  if (projectId) {
    project = await findVisibleProject(viewer, projectId);
    if (!project || !canAddTasksToProject(viewer, project)) return { updatedIds: [], skippedIds: dedupeCap(taskIds) };
  }
  const updatedIds: string[] = [];
  await db.$transaction(async (tx) => {
    for (const task of allowed) {
      if (project && project.workspaceId !== task.workspaceId) {
        skippedIds.push(task.id);
        continue;
      }
      await tx.task.updateMany({ where: { id: task.id, deletedAt: null }, data: { projectId, sectionId: null, version: { increment: 1 } } });
      await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: task.id, action: "updated", data: { fields: ["project"] } });
      updatedIds.push(task.id);
    }
    // No notification: project moves never notify watchers, same as a single-task edit.
  });
  return { updatedIds, skippedIds };
}

// ───────────────────────── Delete ─────────────────────────

export async function bulkDelete(viewer: Viewer, taskIds: string[]): Promise<BulkResult> {
  const { allowed, skippedIds } = await loadBulkEditable(viewer, taskIds, { forDelete: true });
  if (allowed.length === 0) return { updatedIds: [], skippedIds };
  const ids = allowed.map((t) => t.id);
  await db.$transaction(async (tx) => {
    const now = new Date();
    // One statement for the whole batch (plus their subtasks) — not one delete per task.
    await tx.task.updateMany({ where: { deletedAt: null, OR: [{ id: { in: ids } }, { parentId: { in: ids } }] }, data: { deletedAt: now, version: { increment: 1 } } });
    for (const task of allowed) {
      await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: task.id, action: "deleted" });
    }
  });
  return { updatedIds: ids, skippedIds };
}
