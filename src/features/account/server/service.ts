import "server-only";
import type { AppLocale } from "@/i18n/config";
import { db } from "@/server/db";
import type { Viewer } from "@/server/context";

export interface PreferencesInput {
  name?: string;
  timezone?: string;
  weekStartsOn?: number;
  theme?: "SYSTEM" | "LIGHT" | "DARK";
  locale?: AppLocale;
}

/** A user changes only their own preferences; the id always comes from the session viewer. */
export async function updatePreferences(viewer: Viewer, input: PreferencesInput) {
  await db.user.update({ where: { id: viewer.user.id }, data: input });
}
