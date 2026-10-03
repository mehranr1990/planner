// Locale registry. Adding a language = add it here + a messages/<locale>/ folder.
// No database migration is needed: User.locale is a validated string column.

export const LOCALES = ["en", "fa"] as const;
export type AppLocale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

/** Set when a user picks a language; read before Accept-Language for signed-out visitors. */
export const LOCALE_COOKIE = "locale";

const RTL: ReadonlySet<AppLocale> = new Set<AppLocale>(["fa"]);

export function isLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function directionOf(locale: AppLocale): "ltr" | "rtl" {
  return RTL.has(locale) ? "rtl" : "ltr";
}

/** Endonyms — each language is shown in its own script, never translated. */
export const LOCALE_NAMES: Record<AppLocale, string> = {
  en: "English",
  fa: "فارسی",
};
