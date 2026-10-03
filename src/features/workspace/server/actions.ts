"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { isValidTimeZone } from "@/lib/time";
import { getViewer } from "@/server/context";
import { invalidInput, runAction } from "@/server/run-action";
import * as service from "./service";

// validate → viewer → service → revalidate → localized result. Rules live in ./service.

const createSchema = z.object({
  name: z.string().trim().min(2, "workspaceNameTooShort").max(80),
  timezone: z.string().refine(isValidTimeZone, "timezoneUnknown").optional(),
});

export async function createWorkspaceAction(raw: z.input<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("workspace", () => service.createWorkspace(viewer, parsed.data));
}

const switchSchema = z.object({ workspaceId: z.cuid().nullable() });

export async function switchContextAction(raw: z.input<typeof switchSchema>): Promise<ActionResult> {
  const parsed = switchSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("workspace", () => service.switchContext(viewer, parsed.data.workspaceId));
}

const roleSchema = z.object({
  workspaceId: z.cuid(),
  userId: z.cuid(),
  role: z.enum(["OWNER", "ADMIN", "MANAGER", "MEMBER", "GUEST"]),
});

export async function changeMemberRoleAction(raw: z.input<typeof roleSchema>): Promise<ActionResult> {
  const parsed = roleSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("workspace", () => service.changeMemberRole(viewer, parsed.data));
}
