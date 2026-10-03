"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { getViewer } from "@/server/context";
import { invalidInput, runAction } from "@/server/run-action";
import * as service from "./service";

// validate → viewer → service → revalidate → localized result. Rules live in ./service.

const COLORS = ["blue", "red", "yellow", "green", "peach", "slate"] as const;

const createSchema = z.object({
  name: z.string().trim().min(1, "projectNameRequired").max(120),
  description: z.string().trim().max(2000).optional().transform((v) => v || null),
  color: z.enum(COLORS).default("blue"),
  context: z.union([z.literal("personal"), z.cuid()]),
  visibility: z.enum(["PRIVATE", "WORKSPACE"]).default("WORKSPACE"),
});

export async function createProjectAction(raw: z.input<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("projects", () => service.createProject(viewer, parsed.data));
}

const statusSchema = z.object({
  projectId: z.cuid(),
  status: z.enum(["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(),
  health: z.enum(["ON_TRACK", "AT_RISK", "OFF_TRACK"]).optional(),
});

export async function updateProjectStatusAction(raw: z.input<typeof statusSchema>): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  const { projectId, ...change } = parsed.data;
  return runAction("projects", () => service.updateProjectStatus(viewer, projectId, change));
}

const archiveSchema = z.object({ projectId: z.cuid(), archived: z.boolean() });

export async function setProjectArchivedAction(raw: z.input<typeof archiveSchema>): Promise<ActionResult> {
  const parsed = archiveSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("projects", () => service.setProjectArchived(viewer, parsed.data.projectId, parsed.data.archived));
}
