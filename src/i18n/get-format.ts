import "server-only";
import { getLocale, getTranslations } from "next-intl/server";
import { bindFormat, type Format } from "./use-format";

/** Async-server-component twin of useFormat(). */
export async function getFormat(): Promise<Format> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("common.dates")]);
  return bindFormat(locale, { today: t("today"), tomorrow: t("tomorrow"), yesterday: t("yesterday") });
}
