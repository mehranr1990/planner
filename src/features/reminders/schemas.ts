import { z } from "zod";
import { calendarDateSchema } from "@/features/tasks/schemas";

const minutesSchema = z.coerce.number().int().min(0).max(1439);

/**
 * Two ways to set a reminder: an explicit date/time, or "N days before the due date" at a
 * chosen time — resolved server-side (against the task's *current* due date) into the same
 * absolute UTC `remindAt` either way, so storage and delivery never need to know which was used.
 */
export const setReminderSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("absolute"), taskId: z.cuid(), remindOn: calendarDateSchema, remindTime: minutesSchema }),
  z.object({ kind: z.literal("relativeToDue"), taskId: z.cuid(), daysBeforeDue: z.coerce.number().int().min(0).max(365), remindTime: minutesSchema }),
]);

export type SetReminderInput = z.infer<typeof setReminderSchema>;

export const removeReminderSchema = z.object({ taskId: z.cuid() });
