"use server";

import { z } from "zod";
import { getViewer } from "@/server/context";
import { invalidInput, runAction } from "@/server/run-action";
import {
  checklistAddSchema,
  checklistToggleSchema,
  createTaskSchema,
  dependencySchema,
  recurrenceSchema,
  setCompletionSchema,
  updateTaskSchema,
} from "../schemas";
import * as service from "./service";

// validate → viewer → service → revalidate → localized result (src/server/run-action.ts).
// Business rules live in ./service so the command palette, automations and AI reuse them.

const run = <T,>(fn: () => Promise<T>) => runAction("tasks", fn);
const invalid = invalidInput;

export async function createTaskAction(raw: z.input<typeof createTaskSchema>) {
  const parsed = createTaskSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const viewer = await getViewer();
  return run(() => service.createTaskFromQuickAdd(viewer, parsed.data));
}

export async function updateTaskAction(raw: z.input<typeof updateTaskSchema>) {
  const parsed = updateTaskSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const viewer = await getViewer();
  return run(() => service.updateTask(viewer, parsed.data));
}

export async function setTaskCompletionAction(raw: z.input<typeof setCompletionSchema>) {
  const parsed = setCompletionSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const viewer = await getViewer();
  return run(() => service.setTaskCompletion(viewer, parsed.data.taskId, parsed.data.done));
}

export async function setTaskRecurrenceAction(raw: z.input<typeof recurrenceSchema>) {
  const parsed = recurrenceSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const viewer = await getViewer();
  return run(() => service.setTaskRecurrence(viewer, parsed.data.taskId, parsed.data.preset, parsed.data.mode));
}

const idSchema = z.object({ taskId: z.cuid() });

export async function deleteTaskAction(raw: z.input<typeof idSchema>) {
  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const viewer = await getViewer();
  return run(() => service.softDeleteTask(viewer, parsed.data.taskId));
}

export async function restoreTaskAction(raw: z.input<typeof idSchema>) {
  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const viewer = await getViewer();
  return run(() => service.restoreTask(viewer, parsed.data.taskId));
}

export async function addDependencyAction(raw: z.input<typeof dependencySchema>) {
  const parsed = dependencySchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const viewer = await getViewer();
  return run(() => service.addDependency(viewer, parsed.data.blockingTaskId, parsed.data.blockedTaskId));
}

export async function addChecklistItemAction(raw: z.input<typeof checklistAddSchema>) {
  const parsed = checklistAddSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const viewer = await getViewer();
  return run(() => service.addChecklistItem(viewer, parsed.data.taskId, parsed.data.title));
}

export async function toggleChecklistItemAction(raw: z.input<typeof checklistToggleSchema>) {
  const parsed = checklistToggleSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const viewer = await getViewer();
  return run(() => service.toggleChecklistItem(viewer, parsed.data.itemId, parsed.data.isDone));
}
