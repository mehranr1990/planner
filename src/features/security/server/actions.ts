"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { getViewer } from "@/server/context";
import { invalidInput, runAction } from "@/server/run-action";
import * as service from "./service";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "passwordRequired").max(200),
  newPassword: z.string().min(10, "passwordTooShort").max(200),
});

export async function changePasswordAction(raw: z.input<typeof changePasswordSchema>): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("security", () => service.changePassword(viewer, parsed.data));
}

const sessionIdSchema = z.object({ sessionId: z.cuid() });

export async function revokeSessionAction(raw: z.input<typeof sessionIdSchema>): Promise<ActionResult> {
  const parsed = sessionIdSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("security", () => service.revokeSession(viewer, parsed.data.sessionId));
}

export async function revokeOtherSessionsAction(): Promise<ActionResult> {
  const viewer = await getViewer();
  return runAction("security", () => service.revokeOtherSessionsForViewer(viewer));
}
