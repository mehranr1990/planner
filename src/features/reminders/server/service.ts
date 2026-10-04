import "server-only";
import { NOT_FOUND } from "@/lib/action-result";
import { db } from "@/server/db";
import { DomainError } from "@/server/errors";
import { recordActivity } from "@/server/activity";
import type { Viewer } from "@/server/context";
import { addDays, fromDbDate, zonedToUtc, type CalendarDate } from "@/lib/time";
import { findVisibleTask } from "@/features/tasks/server/access";
import type { SetReminderInput } from "../schemas";

export { DomainError };

/**
 * Self-service, visibility-gated — same access rule as watching (Batch 1): anyone who can see
 * the task may set a personal reminder on it for themselves; nobody sets one on another's
 * behalf. At most one reminder per (task, viewer) — setting again replaces it.
 */
export async function setReminder(viewer: Viewer, input: SetReminderInput) {
  const task = await findVisibleTask(viewer, input.taskId);
  if (!task) throw new DomainError(NOT_FOUND);

  let remindOn: CalendarDate;
  if (input.kind === "absolute") {
    remindOn = input.remindOn;
  } else {
    const row = await db.task.findUniqueOrThrow({ where: { id: task.id }, select: { dueOn: true } });
    if (!row.dueOn) throw new DomainError("reminderNeedsDueDate");
    remindOn = addDays(fromDbDate(row.dueOn), -input.daysBeforeDue);
  }
  // Always resolved to an absolute instant now — a relative reminder does not re-float if the
  // due date changes later (see docs/HANDOFF.md for the full due-date-interaction policy).
  const remindAt = zonedToUtc(remindOn, input.remindTime, viewer.user.timezone);

  const existed = await db.reminder.findUnique({ where: { taskId_userId: { taskId: task.id, userId: viewer.user.id } }, select: { id: true } });

  await db.$transaction(async (tx) => {
    await tx.reminder.upsert({
      where: { taskId_userId: { taskId: task.id, userId: viewer.user.id } },
      create: { taskId: task.id, userId: viewer.user.id, remindAt },
      // Editing an already-delivered reminder makes it live again at the new time.
      update: { remindAt, deliveredAt: null },
    });
    await recordActivity(tx, {
      workspaceId: task.workspaceId,
      actorId: viewer.user.id,
      entityType: "task",
      entityId: task.id,
      action: existed ? "reminder_updated" : "reminder_created",
    });
  });

  return { remindAt: remindAt.toISOString() };
}

export async function removeReminder(viewer: Viewer, taskId: string) {
  const task = await findVisibleTask(viewer, taskId);
  if (!task) throw new DomainError(NOT_FOUND);

  await db.$transaction(async (tx) => {
    const res = await tx.reminder.deleteMany({ where: { taskId, userId: viewer.user.id } });
    if (res.count > 0) {
      await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: taskId, action: "reminder_removed" });
    }
  });
}
