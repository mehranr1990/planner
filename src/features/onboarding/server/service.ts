import "server-only";
import type { AppLocale } from "@/i18n/config";
import { isValidTimeZone } from "@/lib/time";
import { db } from "@/server/db";
import type { Viewer } from "@/server/context";

export interface SetupStepInput {
  name: string;
  timezone?: string;
  weekStartsOn?: number;
  locale?: AppLocale;
}

/** Step 1: short, retry-safe — a plain update of the viewer's own account fields. */
export async function saveSetupStep(viewer: Viewer, input: SetupStepInput): Promise<void> {
  await db.user.update({
    where: { id: viewer.user.id },
    data: {
      name: input.name,
      timezone: input.timezone && isValidTimeZone(input.timezone) ? input.timezone : undefined,
      weekStartsOn: input.weekStartsOn,
      locale: input.locale,
      onboardingStep: 2,
    },
  });
}

/** Completing or skipping step 4 both end onboarding the same way — it never permanently limits access. */
export async function completeOnboarding(viewer: Viewer): Promise<void> {
  await db.user.update({ where: { id: viewer.user.id }, data: { onboardedAt: new Date(), onboardingStep: null } });
}
