import { z } from "zod";
import { isCalendarDate, type CalendarDate } from "@/lib/time";

export const calendarDateSchema = z
  .string()
  .refine(isCalendarDate, "invalidInput")
  .transform((v) => v as CalendarDate);

const minutesSchema = z.coerce.number().int().min(0).max(1439);

/** "personal" or a workspace id; membership is verified server-side, never trusted. */
export const contextSchema = z.union([z.literal("personal"), z.cuid()]);

export const createTaskSchema = z.object({
  input: z.string().trim().min(1, "taskInputRequired").max(500),
  clientMutationId: z.uuid(),
  context: contextSchema,
  projectId: z.cuid().nullable().default(null),
  /** Planner view the task was created from — sets sensible defaults (Today → due today). */
  view: z.string().max(20).nullable().default(null),
});

export const prioritySchema = z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]);
export const statusSchema = z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]);

export const updateTaskSchema = z.object({
  taskId: z.cuid(),
  expectedVersion: z.coerce.number().int().min(1),
  title: z.string().trim().min(1, "titleRequired").max(500).optional(),
  description: z.string().max(20_000).nullable().optional(),
  priority: prioritySchema.optional(),
  status: statusSchema.optional(),
  dueOn: calendarDateSchema.nullable().optional(),
  dueTime: minutesSchema.nullable().optional(),
  isSomeday: z.boolean().optional(),
  projectId: z.cuid().nullable().optional(),
  estimateMinutes: z.coerce.number().int().min(0).max(100_000).nullable().optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const setCompletionSchema = z.object({
  taskId: z.cuid(),
  done: z.boolean(),
});

export const recurrenceSchema = z.object({
  taskId: z.cuid(),
  preset: z.enum(["none", "daily", "weekdays", "weekly", "monthly", "yearly"]),
  mode: z.enum(["FIXED_SCHEDULE", "AFTER_COMPLETION"]).default("FIXED_SCHEDULE"),
});

export const dependencySchema = z.object({
  blockingTaskId: z.cuid(),
  blockedTaskId: z.cuid(),
});

export const checklistAddSchema = z.object({
  taskId: z.cuid(),
  title: z.string().trim().min(1).max(500),
});

export const checklistToggleSchema = z.object({
  itemId: z.cuid(),
  isDone: z.boolean(),
});

export const setAssigneesSchema = z.object({
  taskId: z.cuid(),
  userIds: z.array(z.cuid()).max(50),
});

export const setLabelsSchema = z.object({
  taskId: z.cuid(),
  labelIds: z.array(z.cuid()).max(50),
});

export const createSubtaskSchema = z.object({
  parentTaskId: z.cuid(),
  title: z.string().trim().min(1, "titleRequired").max(500),
});
