"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { getViewer } from "@/server/context";
import { CAPABILITIES } from "@/server/permissions/capabilities";
import { invalidInput, runAction } from "@/server/run-action";
import * as service from "./service";

const createSchema = z.object({
  workspaceId: z.cuid(),
  name: z.string().trim().min(2, "roleNameTooShort").max(60),
  baseRole: z.enum(["ADMIN", "MANAGER", "MEMBER", "GUEST"]),
  capabilities: z.array(z.enum(CAPABILITIES)),
});

export async function createCustomRoleAction(raw: z.input<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("roles", () => service.createCustomRole(viewer, parsed.data));
}

const updateSchema = z.object({
  roleId: z.cuid(),
  name: z.string().trim().min(2, "roleNameTooShort").max(60).optional(),
  capabilities: z.array(z.enum(CAPABILITIES)).optional(),
});

export async function updateCustomRoleAction(raw: z.input<typeof updateSchema>): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("roles", () => service.updateCustomRole(viewer, parsed.data));
}

const roleIdSchema = z.object({ roleId: z.cuid() });

export async function deleteCustomRoleAction(raw: z.input<typeof roleIdSchema>): Promise<ActionResult> {
  const parsed = roleIdSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("roles", () => service.deleteCustomRole(viewer, parsed.data.roleId));
}

const assignSchema = z.object({ workspaceId: z.cuid(), userId: z.cuid(), customRoleId: z.cuid().nullable() });

export async function assignCustomRoleAction(raw: z.input<typeof assignSchema>): Promise<ActionResult> {
  const parsed = assignSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("roles", () => service.assignCustomRole(viewer, parsed.data));
}
