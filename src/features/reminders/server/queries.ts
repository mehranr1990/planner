import "server-only";
import { db } from "@/server/db";
import type { Viewer } from "@/server/context";
import { findVisibleTask } from "@/features/tasks/server/access";
import type { ReminderDetail } from "../types";

/** The viewer's own reminder on a task — never anyone else's (reminders are personal, Batch 3 §2). */
export async function getMyReminder(viewer: Viewer, taskId: string): Promise<ReminderDetail | null> {
  const task = await findVisibleTask(viewer, taskId);
  if (!task) return null;
  const row = await db.reminder.findUnique({
    where: { taskId_userId: { taskId, userId: viewer.user.id } },
    select: { remindAt: true, deliveredAt: true },
  });
  if (!row) return null;
  return { remindAt: row.remindAt.toISOString(), delivered: row.deliveredAt !== null };
}
