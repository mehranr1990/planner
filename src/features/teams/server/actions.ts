"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { getViewer } from "@/server/context";
import { invalidInput, runAction } from "@/server/run-action";
import * as service from "./service";

const createSchema = z.object({
  workspaceId: z.cuid(),
  name: z.string().trim().min(2, "teamNameTooShort").max(80),
  description: z.string().trim().max(500).optional(),
});

export async function createTeamAction(raw: z.input<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("teams", () => service.createTeam(viewer, parsed.data));
}

const renameSchema = z.object({
  teamId: z.cuid(),
  name: z.string().trim().min(2, "teamNameTooShort").max(80),
  description: z.string().trim().max(500).optional(),
});

export async function renameTeamAction(raw: z.input<typeof renameSchema>): Promise<ActionResult> {
  const parsed = renameSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("teams", () => service.renameTeam(viewer, parsed.data));
}

const teamIdSchema = z.object({ teamId: z.cuid() });

export async function archiveTeamAction(raw: z.input<typeof teamIdSchema>): Promise<ActionResult> {
  const parsed = teamIdSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("teams", () => service.archiveTeam(viewer, parsed.data.teamId));
}

const memberSchema = z.object({ teamId: z.cuid(), userId: z.cuid(), role: z.enum(["LEAD", "MEMBER"]).optional() });

export async function addTeamMemberAction(raw: z.input<typeof memberSchema>): Promise<ActionResult> {
  const parsed = memberSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("teams", () => service.addTeamMember(viewer, parsed.data));
}

const removeMemberSchema = z.object({ teamId: z.cuid(), userId: z.cuid() });

export async function removeTeamMemberAction(raw: z.input<typeof removeMemberSchema>): Promise<ActionResult> {
  const parsed = removeMemberSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("teams", () => service.removeTeamMember(viewer, parsed.data));
}

const leadSchema = z.object({ teamId: z.cuid(), userId: z.cuid(), isLead: z.boolean() });

export async function setTeamLeadAction(raw: z.input<typeof leadSchema>): Promise<ActionResult> {
  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("teams", () => service.setTeamLead(viewer, parsed.data));
}
