"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { isValidTimeZone } from "@/lib/time";
import { isLocale, LOCALE_COOKIE, type AppLocale } from "@/i18n/config";
import { localizeError } from "@/i18n/errors";
import { getViewer } from "@/server/context";
import { invalidInput, runAction } from "@/server/run-action";
import * as service from "./service";

const localeSchema = z
  .string()
  .refine(isLocale, "localeUnsupported")
  .transform((v) => v as AppLocale);

const profileSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(80).optional(),
  timezone: z.string().refine(isValidTimeZone, "timezoneUnknown").optional(),
  weekStartsOn: z.coerce.number().int().min(0).max(6).optional(),
  theme: z.enum(["SYSTEM", "LIGHT", "DARK"]).optional(),
  locale: localeSchema.optional(),
});

/** Remembers the language for this browser (sign-in pages, after sign-out). Transport concern, so it stays here. */
async function rememberLocale(locale: AppLocale) {
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", sameSite: "lax", maxAge: 365 * 86_400 });
}

export async function updatePreferencesAction(raw: z.input<typeof profileSchema>): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  const viewer = await getViewer();
  return runAction("account", async () => {
    await service.updatePreferences(viewer, parsed.data);
    if (parsed.data.locale) await rememberLocale(parsed.data.locale);
  });
}

/** Language choice before signing in. Signed-in users change it in Settings (stored on the account). */
export async function setGuestLocaleAction(raw: string): Promise<ActionResult> {
  const parsed = localeSchema.safeParse(raw);
  if (!parsed.success) return fail(await localizeError("localeUnsupported"));
  return runAction("account", () => rememberLocale(parsed.data));
}

/** FormData (not a Zod-validated object) because a browser `File` has no meaningful Zod schema —
 * the real validation happens in service.ts, against the actual bytes. */
export async function uploadAvatarAction(form: FormData): Promise<ActionResult<{ avatarUrl: string }>> {
  const file = form.get("file");
  if (!(file instanceof File)) return fail(await localizeError("invalidInput"));
  const viewer = await getViewer();
  return runAction("account", () => service.setAvatar(viewer, file));
}

export async function removeAvatarAction(): Promise<ActionResult> {
  const viewer = await getViewer();
  return runAction("account", () => service.removeAvatar(viewer));
}
