"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { getViewer } from "@/server/context";
import { invalidInput, runAction } from "@/server/run-action";
import * as service from "./service";

const sendSchema = z.object({
  workspaceId: z.cuid(),
  email: z.email("emailInvalid").max(254).transform((v) => v.toLowerCase()),
  role: z.enum(["ADMIN", "MANAGER", "MEMBER", "GUEST"]),
  isExternal: z.boolean().optional(),
});

export async function sendInvitationAction(raw: z.input<typeof sendSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = sendSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("invitations", () => service.sendInvitation(viewer, parsed.data));
}

const idSchema = z.object({ invitationId: z.cuid() });

export async function revokeInvitationAction(raw: z.input<typeof idSchema>): Promise<ActionResult> {
  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("invitations", () => service.revokeInvitation(viewer, parsed.data.invitationId));
}

export async function resendInvitationAction(raw: z.input<typeof idSchema>): Promise<ActionResult> {
  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("invitations", () => service.resendInvitation(viewer, parsed.data.invitationId));
}

const acceptSchema = z.object({ token: z.string().min(1) });

export async function acceptInvitationAction(raw: z.input<typeof acceptSchema>): Promise<ActionResult<{ workspaceId: string }>> {
  const parsed = acceptSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("invitations", () => service.acceptInvitation(parsed.data.token, viewer.user.id));
}
