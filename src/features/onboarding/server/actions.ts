"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { isLocale, type AppLocale } from "@/i18n/config";
import { isValidTimeZone } from "@/lib/time";
import { getViewer } from "@/server/context";
import { invalidInput, runAction } from "@/server/run-action";
import * as service from "./service";

const setupSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(80),
  timezone: z.string().refine(isValidTimeZone, "timezoneUnknown").optional(),
  weekStartsOn: z.coerce.number().int().min(0).max(6).optional(),
  locale: z
    .string()
    .refine(isLocale, "localeUnsupported")
    .transform((v) => v as AppLocale)
    .optional(),
});

export async function saveOnboardingSetupAction(raw: z.input<typeof setupSchema>): Promise<ActionResult> {
  const parsed = setupSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("onboarding", () => service.saveSetupStep(viewer, parsed.data));
}

export async function completeOnboardingAction(): Promise<ActionResult> {
  const viewer = await getViewer();
  return runAction("onboarding", () => service.completeOnboarding(viewer));
}
