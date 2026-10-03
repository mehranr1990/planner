// Locale-aware presentation formatting. Pure functions with an explicit locale so server and
// client produce identical output. Values stay canonical; only display is localized.
//
// Calendar: dates are always shown in the Gregorian calendar (`ca-gregory`). Persian ("fa")
// defaults to the Solar Hijri calendar in Intl; switching to it is a product decision that
// has not been made, and it would disagree with the native Gregorian date inputs.

import type { CalendarDate } from "@/lib/time";
import { diffDays } from "@/lib/time";

const cache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();

function dateFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `d|${locale}|${JSON.stringify(options)}`;
  let f = cache.get(key) as Intl.DateTimeFormat | undefined;
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { calendar: "gregory", ...options });
    cache.set(key, f);
  }
  return f;
}

function numberFormatter(locale: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = `n|${locale}|${JSON.stringify(options)}`;
  let f = cache.get(key) as Intl.NumberFormat | undefined;
  if (!f) {
    f = new Intl.NumberFormat(locale, options);
    cache.set(key, f);
  }
  return f;
}

function utcMidnight(date: CalendarDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function formatNumber(value: number, locale: string): string {
  return numberFormatter(locale).format(value);
}

/** `fraction` is 0…1. */
export function formatPercent(fraction: number, locale: string): string {
  return numberFormatter(locale, { style: "percent", maximumFractionDigits: 0 }).format(fraction);
}

/** A floating calendar date (no timezone shift). */
export function formatCalendarDate(
  date: CalendarDate,
  locale: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
): string {
  return dateFormatter(locale, { ...options, timeZone: "UTC" }).format(utcMidnight(date));
}

/** Wall-clock time of an instant in a timezone. */
export function formatTime(instant: Date, timeZone: string, locale: string): string {
  return dateFormatter(locale, { timeZone, hour: "numeric", minute: "2-digit" }).format(instant);
}

/** Minutes after midnight as a localized clock time (no timezone involved). */
export function formatMinutes(minutes: number, locale: string): string {
  const at = new Date(Date.UTC(2000, 0, 1, Math.floor(minutes / 60), minutes % 60));
  return dateFormatter(locale, { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(at);
}

export function formatDateTime(instant: Date, timeZone: string, locale: string): string {
  return dateFormatter(locale, { timeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(instant);
}

export interface RelativeDayLabels {
  today: string;
  tomorrow: string;
  yesterday: string;
}

/** Today / Tomorrow / Yesterday (from the catalog), weekday within 6 days, else a short date. */
export function relativeDayLabel(date: CalendarDate, today: CalendarDate, locale: string, labels: RelativeDayLabels): string {
  const delta = diffDays(date, today);
  if (delta === 0) return labels.today;
  if (delta === 1) return labels.tomorrow;
  if (delta === -1) return labels.yesterday;
  if (delta > 1 && delta < 7) return formatCalendarDate(date, locale, { weekday: "long" });
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return formatCalendarDate(date, locale, sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}
