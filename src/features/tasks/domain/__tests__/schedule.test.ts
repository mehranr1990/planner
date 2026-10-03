import { describe, expect, it } from "vitest";
import { calendarDate as d } from "@/lib/time";
import { normalizeSchedule, ScheduleError } from "../schedule";

describe("normalizeSchedule", () => {
  it("stores all-day tasks without instants", () => {
    expect(normalizeSchedule({ dueOn: d("2026-10-05"), timezone: "Asia/Tehran" })).toEqual({
      isAllDay: true,
      timezone: null,
      dueOn: "2026-10-05",
      dueAt: null,
      startOn: null,
      startAt: null,
    });
  });

  it("derives dueOn from the instant for timed tasks", () => {
    const s = normalizeSchedule({ dueOn: d("2026-10-05"), dueTime: 23 * 60 + 30, timezone: "Asia/Tehran" });
    expect(s.isAllDay).toBe(false);
    expect(s.dueAt?.toISOString()).toBe("2026-10-05T20:00:00.000Z");
    expect(s.dueOn).toBe("2026-10-05");
    expect(s.timezone).toBe("Asia/Tehran");
  });

  it("rejects a time without a date", () => {
    expect(() => normalizeSchedule({ dueTime: 600, timezone: "UTC" })).toThrow(ScheduleError);
  });

  it("rejects start after due", () => {
    expect(() => normalizeSchedule({ startOn: d("2026-10-06"), dueOn: d("2026-10-05"), timezone: "UTC" })).toThrow(ScheduleError);
    expect(() =>
      normalizeSchedule({ startOn: d("2026-10-05"), startTime: 600, dueOn: d("2026-10-05"), dueTime: 540, timezone: "UTC" }),
    ).toThrow(ScheduleError);
  });

  it("rejects out-of-range times", () => {
    expect(() => normalizeSchedule({ dueOn: d("2026-10-05"), dueTime: 1440, timezone: "UTC" })).toThrow(ScheduleError);
  });
});
