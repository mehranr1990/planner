import { DEFAULT_LOCALE, isLocale, LOCALES, type AppLocale } from "./config";

/**
 * Picks the best supported locale from an Accept-Language header.
 * Honours q-values; matches region tags to their base language (fa-IR → fa).
 */
export function matchAcceptLanguage(header: string | null | undefined): AppLocale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const quality = q ? Number(q.slice(2)) : 1;
      return { tag: tag.toLowerCase(), quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((x) => x.tag && x.tag !== "*" && x.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    const hit = LOCALES.find((l) => l === tag || l === base);
    if (hit) return hit;
  }
  return null;
}

/**
 * The single locale-resolution rule (server-side only, so server and client always agree):
 *   1. signed-in user's saved preference
 *   2. locale cookie
 *   3. Accept-Language
 *   4. English
 * Unknown values at any step are ignored rather than trusted.
 */
export function resolveLocale(input: {
  userLocale?: string | null;
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
}): AppLocale {
  if (isLocale(input.userLocale)) return input.userLocale;
  if (isLocale(input.cookieLocale)) return input.cookieLocale;
  return matchAcceptLanguage(input.acceptLanguage) ?? DEFAULT_LOCALE;
}
