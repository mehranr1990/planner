import { useLocale, useTranslations } from "next-intl";
import {
  formatCalendarDate,
  formatDateTime,
  formatMinutes,
  formatNumber,
  formatPercent,
  formatTime,
  relativeDayLabel,
  type RelativeDayLabels,
} from "@/lib/format";
import type { CalendarDate } from "@/lib/time";

export function bindFormat(locale: string, labels: RelativeDayLabels) {
  return {
    locale,
    number: (n: number) => formatNumber(n, locale),
    percent: (fraction: number) => formatPercent(fraction, locale),
    date: (d: CalendarDate, options?: Intl.DateTimeFormatOptions) => formatCalendarDate(d, locale, options),
    time: (instant: Date, timeZone: string) => formatTime(instant, timeZone, locale),
    minutes: (m: number) => formatMinutes(m, locale),
    dateTime: (instant: Date, timeZone: string) => formatDateTime(instant, timeZone, locale),
    relativeDay: (d: CalendarDate, today: CalendarDate) => relativeDayLabel(d, today, locale, labels),
  };
}

export type Format = ReturnType<typeof bindFormat>;

/** Formatting bound to the request locale. Works in client and non-async server components. */
export function useFormat(): Format {
  const locale = useLocale();
  const t = useTranslations("common.dates");
  return bindFormat(locale, { today: t("today"), tomorrow: t("tomorrow"), yesterday: t("yesterday") });
}
