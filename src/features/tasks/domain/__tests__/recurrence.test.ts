import { describe, expect, it } from "vitest";
import { calendarDate as d } from "@/lib/time";
import { nextOccurrence, occurrences, RecurrenceError, type RecurrenceRule } from "../recurrence";

const base: RecurrenceRule = {
  frequency: "DAILY",
  interval: 1,
  byWeekday: [],
  byMonthDay: [],
  mode: "FIXED_SCHEDULE",
  startsOn: d("2026-10-01"),
  untilOn: null,
  maxCount: null,
};

describe("occurrences", () => {
  it("daily with interval", () => {
    expect(occurrences({ ...base, interval: 3 }, 3)).toEqual(["2026-10-01", "2026-10-04", "2026-10-07"]);
  });

  it("weekly on specific weekdays, starting mid-week", () => {
    // 2026-10-01 is a Thursday; Mon/Wed/Fri every week.
    expect(occurrences({ ...base, frequency: "WEEKLY", byWeekday: [1, 3, 5] }, 4)).toEqual([
      "2026-10-02",
      "2026-10-05",
      "2026-10-07",
      "2026-10-09",
    ]);
  });

  it("bi-weekly defaults to the start weekday", () => {
    expect(occurrences({ ...base, frequency: "WEEKLY", interval: 2 }, 3)).toEqual(["2026-10-01", "2026-10-15", "2026-10-29"]);
  });

  it("monthly on the 31st skips short months", () => {
    expect(occurrences({ ...base, frequency: "MONTHLY", startsOn: d("2026-01-31") }, 4)).toEqual([
      "2026-01-31",
      "2026-03-31",
      "2026-05-31",
      "2026-07-31",
    ]);
  });

  it("monthly on the last day", () => {
    expect(occurrences({ ...base, frequency: "MONTHLY", startsOn: d("2026-01-15"), byMonthDay: [-1] }, 3)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });

  it("yearly Feb 29 clamps in non-leap years", () => {
    expect(occurrences({ ...base, frequency: "YEARLY", startsOn: d("2028-02-29") }, 3)).toEqual(["2028-02-29", "2029-02-28", "2030-02-28"]);
  });

  it("respects until and max count", () => {
    expect(occurrences({ ...base, untilOn: d("2026-10-03") }, 10)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(occurrences({ ...base, maxCount: 2 }, 10)).toEqual(["2026-10-01", "2026-10-02"]);
  });

  it("rejects malformed rules", () => {
    expect(() => occurrences({ ...base, interval: 0 }, 1)).toThrow(RecurrenceError);
    expect(() => occurrences({ ...base, byWeekday: [7] }, 1)).toThrow(RecurrenceError);
    expect(() => occurrences({ ...base, untilOn: d("2026-09-01") }, 1)).toThrow(RecurrenceError);
  });
});

describe("nextOccurrence", () => {
  it("fixed schedule ignores late completion", () => {
    const rule = { ...base, frequency: "WEEKLY" as const };
    expect(nextOccurrence(rule, { lastOccurrenceOn: d("2026-10-01"), generatedCount: 1, completedOn: d("2026-10-20") })).toBe("2026-10-08");
  });

  it("after-completion counts from the completion date", () => {
    const rule = { ...base, frequency: "WEEKLY" as const, mode: "AFTER_COMPLETION" as const };
    expect(nextOccurrence(rule, { lastOccurrenceOn: d("2026-10-01"), generatedCount: 1, completedOn: d("2026-10-20") })).toBe("2026-10-27");
  });

  it("ends at max count and until", () => {
    expect(nextOccurrence({ ...base, maxCount: 3 }, { lastOccurrenceOn: d("2026-10-03"), generatedCount: 3, completedOn: d("2026-10-03") })).toBeNull();
    expect(nextOccurrence({ ...base, untilOn: d("2026-10-03") }, { lastOccurrenceOn: d("2026-10-03"), generatedCount: 3, completedOn: d("2026-10-03") })).toBeNull();
  });
});
