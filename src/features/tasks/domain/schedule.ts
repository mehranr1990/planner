import { compareDates, localDate, zonedToUtc, type CalendarDate } from "@/lib/time";

/** What the user entered. Times are minutes after local midnight in `timezone`. */
export interface ScheduleInput {
  dueOn?: CalendarDate | null;
  dueTime?: number | null;
  startOn?: CalendarDate | null;
  startTime?: number | null;
  timezone: string;
}

/** What gets stored (matches the Task columns and the tasks_schedule_check constraint). */
export interface StoredSchedule {
  isAllDay: boolean;
  timezone: string | null;
  dueOn: CalendarDate | null;
  dueAt: Date | null;
  startOn: CalendarDate | null;
  startAt: Date | null;
}

export type ScheduleErrorCode =
  | "dueTimeNeedsDate"
  | "startTimeNeedsDate"
  | "dueTimeOutOfRange"
  | "startTimeOutOfRange"
  | "startAfterDue"
  | "startAfterDueTime";

/** Carries a stable code (an `errors.*` catalog key); never user-facing prose. */
export class ScheduleError extends Error {
  constructor(public readonly code: ScheduleErrorCode) {
    super(code);
  }
}

function assertMinutes(value: number, code: "dueTimeOutOfRange" | "startTimeOutOfRange") {
  if (!Number.isInteger(value) || value < 0 || value >= 24 * 60) throw new ScheduleError(code);
}

/**
 * Normalises a schedule. A task is timed when any time is given; otherwise all-day.
 * dueOn is always derived from dueAt for timed tasks, so planner bucketing has one source.
 */
export function normalizeSchedule(input: ScheduleInput): StoredSchedule {
  const { dueOn = null, dueTime = null, startOn = null, startTime = null, timezone } = input;

  if (dueTime !== null && dueOn === null) throw new ScheduleError("dueTimeNeedsDate");
  if (startTime !== null && startOn === null) throw new ScheduleError("startTimeNeedsDate");
  if (dueTime !== null) assertMinutes(dueTime, "dueTimeOutOfRange");
  if (startTime !== null) assertMinutes(startTime, "startTimeOutOfRange");

  const timed = dueTime !== null || startTime !== null;
  if (!timed) {
    if (startOn && dueOn && compareDates(startOn, dueOn) > 0) {
      throw new ScheduleError("startAfterDue");
    }
    return { isAllDay: true, timezone: null, dueOn, dueAt: null, startOn, startAt: null };
  }

  const dueAt = dueOn !== null && dueTime !== null ? zonedToUtc(dueOn, dueTime, timezone) : null;
  const startAt = startOn !== null && startTime !== null ? zonedToUtc(startOn, startTime, timezone) : null;
  if (dueAt && startAt && startAt.getTime() > dueAt.getTime()) {
    throw new ScheduleError("startAfterDueTime");
  }
  if (startOn && dueOn && compareDates(startOn, dueOn) > 0) {
    throw new ScheduleError("startAfterDue");
  }
  return {
    isAllDay: false,
    timezone,
    dueOn: dueAt ? localDate(dueAt, timezone) : dueOn,
    dueAt,
    startOn: startAt ? localDate(startAt, timezone) : startOn,
    startAt,
  };
}
