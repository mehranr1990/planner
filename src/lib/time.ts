// Timezone-aware calendar helpers built on Intl — no date library.
//
// Two kinds of values:
//   CalendarDate  "YYYY-MM-DD"  a floating local date (all-day tasks, habits, recurrence dates)
//   Date          an absolute UTC instant (timed tasks, timestamps)
// Postgres `date` columns arrive from Prisma as Date at UTC midnight; convert with
// `fromDbDate` / `toDbDate` and never do local-time arithmetic on them.

export type CalendarDate = string & { readonly __brand: "CalendarDate" };

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCalendarDate(value: string): value is CalendarDate {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d;
}

export function calendarDate(value: string): CalendarDate {
  if (!isCalendarDate(value)) throw new RangeError(`Invalid calendar date: ${value}`);
  return value;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

function parts(date: CalendarDate): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return { y, m, d };
}

function fromUtcMidnight(ms: number): CalendarDate {
  const dt = new Date(ms);
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}` as CalendarDate;
}

function utcMidnight(date: CalendarDate): number {
  const { y, m, d } = parts(date);
  return Date.UTC(y, m - 1, d);
}

// ── Calendar-date arithmetic (timezone-free by construction) ──

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return fromUtcMidnight(utcMidnight(date) + days * 86_400_000);
}

/** Adds months; the day is clamped to the target month's length (Jan 31 + 1 → Feb 28/29). */
export function addMonthsClamped(date: CalendarDate, months: number): CalendarDate {
  const { y, m, d } = parts(date);
  const total = y * 12 + (m - 1) + months;
  const ty = Math.floor(total / 12);
  const tm = total - ty * 12;
  return fromUtcMidnight(Date.UTC(ty, tm, Math.min(d, daysInMonth(ty, tm + 1))));
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(date: CalendarDate): number {
  return new Date(utcMidnight(date)).getUTCDay();
}

export function diffDays(a: CalendarDate, b: CalendarDate): number {
  return Math.round((utcMidnight(a) - utcMidnight(b)) / 86_400_000);
}

export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function startOfWeek(date: CalendarDate, weekStartsOn: number): CalendarDate {
  return addDays(date, -((weekday(date) - weekStartsOn + 7) % 7));
}

// ── Instants ↔ zoned wall time ──

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function zonedFormatter(tz: string): Intl.DateTimeFormat {
  let f = formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(tz, f);
  }
  return f;
}

function wallClock(instant: Date, tz: string) {
  const out: Record<string, number> = {};
  for (const p of zonedFormatter(tz).formatToParts(instant)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Offset of `tz` from UTC at `instant`, in minutes (e.g. +210 for Asia/Tehran). */
export function tzOffsetMinutes(instant: Date, tz: string): number {
  const w = wallClock(instant, tz);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/** Local calendar date of an instant in a timezone. */
export function localDate(instant: Date, tz: string): CalendarDate {
  const w = wallClock(instant, tz);
  return `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}` as CalendarDate;
}

/** Minutes after local midnight of an instant in a timezone. */
export function localMinutes(instant: Date, tz: string): number {
  const w = wallClock(instant, tz);
  return w.hour * 60 + w.minute;
}

/**
 * Converts a local wall time to a UTC instant.
 * DST gap (time doesn't exist): shifts forward by the gap, like most calendar apps.
 * DST overlap (time occurs twice): picks the earlier instant.
 */
export function zonedToUtc(date: CalendarDate, minutesAfterMidnight: number, tz: string): Date {
  const naive = utcMidnight(date) + minutesAfterMidnight * 60_000;
  // At most one transition happens near a given wall time, so the offsets a day either side
  // are the only two candidates.
  const before = tzOffsetMinutes(new Date(naive - 86_400_000), tz);
  const after = tzOffsetMinutes(new Date(naive + 86_400_000), tz);
  const valid = [before, after]
    .map((offset) => ({ offset, at: naive - offset * 60_000 }))
    .filter((c) => tzOffsetMinutes(new Date(c.at), tz) === c.offset)
    .map((c) => c.at);
  if (valid.length > 0) return new Date(Math.min(...valid));
  // Nonexistent local time: the pre-transition offset lands the same distance past the gap.
  return new Date(naive - before * 60_000);
}

export function todayIn(tz: string, now: Date = new Date()): CalendarDate {
  return localDate(now, tz);
}

// ── Database `date` columns ──

export function toDbDate(date: CalendarDate): Date {
  return new Date(utcMidnight(date));
}

export function fromDbDate(value: Date): CalendarDate {
  return fromUtcMidnight(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

// Display formatting lives in src/lib/format.ts (locale-aware).
