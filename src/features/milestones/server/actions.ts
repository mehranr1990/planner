"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { isCalendarDate, type CalendarDate } from "@/lib/time";
import { getViewer } from "@/server/context";
import { invalidInput, runAction } from "@/server/run-action";
import * as service from "./service";

// validate → viewer → service → revalidate → localized result (src/server/run-action.ts).

const run = <T,>(fn: () => Promise<T>) => runAction("milestones", fn);

const dueOnSchema = z
  .string()
  .refine(isCalendarDate, "invalidInput")
  .transform((v) => v as CalendarDate);

const titleSchema = z.string().trim().min(1, "titleRequired").max(200);
const descriptionSchema = z
  .string()
  .trim()
  .max(2000)
  .nullable()
  .optional()
  .transform((v) => v || null);

const createSchema = z.object({
  projectId: z.cuid(),
  title: titleSchema,
  description: descriptionSchema,
  dueOn: dueOnSchema.nullable().default(null),
});

export async function createMilestoneAction(raw: z.input<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return run(() => service.createMilestone(viewer, parsed.data.projectId, parsed.data));
}

const updateSchema = z.object({
  milestoneId: z.cuid(),
  title: titleSchema.optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  dueOn: dueOnSchema.nullable().optional(),
});

export async function updateMilestoneAction(raw: z.input<typeof updateSchema>): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  const { milestoneId, ...input } = parsed.data;
  return run(() => service.updateMilestone(viewer, milestoneId, input));
}

const completionSchema = z.object({ milestoneId: z.cuid(), done: z.boolean() });

export async function setMilestoneCompletionAction(raw: z.input<typeof completionSchema>): Promise<ActionResult> {
  const parsed = completionSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return run(() => service.setMilestoneCompletion(viewer, parsed.data.milestoneId, parsed.data.done));
}

const idSchema = z.object({ milestoneId: z.cuid() });

export async function archiveMilestoneAction(raw: z.input<typeof idSchema>): Promise<ActionResult> {
  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return run(() => service.archiveMilestone(viewer, parsed.data.milestoneId));
}

const reorderSchema = z.object({ milestoneId: z.cuid(), beforeId: z.cuid().nullable(), afterId: z.cuid().nullable() });

export async function reorderMilestoneAction(raw: z.input<typeof reorderSchema>): Promise<ActionResult> {
  const parsed = reorderSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return run(() => service.reorderMilestone(viewer, parsed.data.milestoneId, { beforeId: parsed.data.beforeId, afterId: parsed.data.afterId }));
}
