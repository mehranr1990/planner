import {
  addDays,
  addMonthsClamped,
  compareDates,
  daysInMonth,
  weekday,
  type CalendarDate,
} from "@/lib/time";

export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type RecurrenceMode = "FIXED_SCHEDULE" | "AFTER_COMPLETION";

export interface RecurrenceRule {
  frequency: Frequency;
  interval: number;
  /** WEEKLY: 0 = Sunday … 6 = Saturday. Empty → the start date's weekday. */
  byWeekday: readonly number[];
  /** MONTHLY: 1…31 or -1 for the last day. Empty → the start date's day of month. */
  byMonthDay: readonly number[];
  mode: RecurrenceMode;
  startsOn: CalendarDate;
  untilOn: CalendarDate | null;
  maxCount: number | null;
}

export type RecurrenceErrorCode =
  | "recurrenceInterval"
  | "recurrenceWeekdays"
  | "recurrenceMonthDays"
  | "recurrenceEndBeforeStart"
  | "recurrenceCount";

export class RecurrenceError extends Error {
  constructor(public readonly code: RecurrenceErrorCode) {
    super(code);
  }
}

export function validateRule(rule: RecurrenceRule): void {
  if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 366) {
    throw new RecurrenceError("recurrenceInterval");
  }
  if (rule.byWeekday.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw new RecurrenceError("recurrenceWeekdays");
  }
  if (rule.byMonthDay.some((d) => !Number.isInteger(d) || d === 0 || d < -1 || d > 31)) {
    throw new RecurrenceError("recurrenceMonthDays");
  }
  if (rule.untilOn && compareDates(rule.untilOn, rule.startsOn) < 0) {
    throw new RecurrenceError("recurrenceEndBeforeStart");
  }
  if (rule.maxCount !== null && (!Number.isInteger(rule.maxCount) || rule.maxCount < 1)) {
    throw new RecurrenceError("recurrenceCount");
  }
}

function monthDaysFor(rule: RecurrenceRule, year: number, month1: number): CalendarDate[] {
  const wanted = rule.byMonthDay.length > 0 ? rule.byMonthDay : [Number(rule.startsOn.slice(8, 10))];
  const last = daysInMonth(year, month1);
  const days = new Set<number>();
  for (const d of wanted) {
    if (d === -1) days.add(last);
    else if (d <= last) days.add(d); // RFC 5545: a 31st that doesn't exist is skipped, not clamped
  }
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => `${String(year).padStart(4, "0")}-${String(month1).padStart(2, "0")}-${String(d).padStart(2, "0")}` as CalendarDate);
}

/**
 * Lazily yields scheduled dates on or after the series start, in order.
 * Hard-capped so a malformed rule can never loop forever.
 */
function* schedule(rule: RecurrenceRule): Generator<CalendarDate> {
  const LIMIT = 20_000;
  let emitted = 0;
  const start = rule.startsOn;
  const withinUntil = (d: CalendarDate) => !rule.untilOn || compareDates(d, rule.untilOn) <= 0;

  switch (rule.frequency) {
    case "DAILY": {
      for (let d = start; withinUntil(d) && emitted < LIMIT; d = addDays(d, rule.interval)) {
        emitted++;
        yield d;
      }
      return;
    }
    case "WEEKLY": {
      const days = (rule.byWeekday.length > 0 ? [...rule.byWeekday] : [weekday(start)]).sort((a, b) => a - b);
      // Weeks are anchored on the Sunday on or before the start date.
      let weekStart = addDays(start, -weekday(start));
      for (let guard = 0; guard < LIMIT; guard++, weekStart = addDays(weekStart, 7 * rule.interval)) {
        for (const wd of days) {
          const d = addDays(weekStart, wd);
          if (compareDates(d, start) < 0) continue;
          if (!withinUntil(d)) return;
          emitted++;
          yield d;
        }
      }
      return;
    }
    case "MONTHLY": {
      const y0 = Number(start.slice(0, 4));
      const m0 = Number(start.slice(5, 7));
      for (let i = 0; i < LIMIT; i += rule.interval) {
        const total = (m0 - 1) + i;
        const y = y0 + Math.floor(total / 12);
        const m = (total % 12) + 1;
        for (const d of monthDaysFor(rule, y, m)) {
          if (compareDates(d, start) < 0) continue;
          if (!withinUntil(d)) return;
          emitted++;
          yield d;
        }
      }
      return;
    }
    case "YEARLY": {
      // Feb 29 series clamp to Feb 28 in non-leap years (the anchor stays Feb 29).
      for (let i = 0; i < LIMIT; i += rule.interval) {
        const d = addMonthsClamped(start, i * 12);
        if (!withinUntil(d)) return;
        emitted++;
        yield d;
      }
      return;
    }
  }
}

/** First `count` occurrence dates of a fixed-schedule series. */
export function occurrences(rule: RecurrenceRule, count: number): CalendarDate[] {
  validateRule(rule);
  const out: CalendarDate[] = [];
  const max = rule.maxCount ?? Infinity;
  for (const d of schedule(rule)) {
    if (out.length >= count || out.length >= max) break;
    out.push(d);
  }
  return out;
}

export interface NextOccurrenceContext {
  /** The occurrence being completed / the last generated occurrence. */
  lastOccurrenceOn: CalendarDate;
  /** How many occurrences have been generated so far (for maxCount). */
  generatedCount: number;
  /** Local completion date — used by AFTER_COMPLETION series. */
  completedOn: CalendarDate;
}

/**
 * The next occurrence to generate, or null when the series has ended.
 * FIXED_SCHEDULE: the first scheduled date strictly after the last occurrence.
 * AFTER_COMPLETION: completion date + one interval (rule shape ignored beyond frequency/interval).
 */
export function nextOccurrence(rule: RecurrenceRule, ctx: NextOccurrenceContext): CalendarDate | null {
  validateRule(rule);
  if (rule.maxCount !== null && ctx.generatedCount >= rule.maxCount) return null;

  let next: CalendarDate | null = null;
  if (rule.mode === "AFTER_COMPLETION") {
    const base = ctx.completedOn;
    switch (rule.frequency) {
      case "DAILY":
        next = addDays(base, rule.interval);
        break;
      case "WEEKLY":
        next = addDays(base, 7 * rule.interval);
        break;
      case "MONTHLY":
        next = addMonthsClamped(base, rule.interval);
        break;
      case "YEARLY":
        next = addMonthsClamped(base, 12 * rule.interval);
        break;
    }
  } else {
    for (const d of schedule(rule)) {
      if (compareDates(d, ctx.lastOccurrenceOn) > 0) {
        next = d;
        break;
      }
    }
  }
  if (next && rule.untilOn && compareDates(next, rule.untilOn) > 0) return null;
  return next;
}
