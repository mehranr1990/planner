import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonthsClamped,
  calendarDate as d,
  fromDbDate,
  isCalendarDate,
  localDate,
  startOfWeek,
  toDbDate,
  tzOffsetMinutes,
  weekday,
  zonedToUtc,
} from "@/lib/time";

describe("calendar dates", () => {
  it("validates real dates only", () => {
    expect(isCalendarDate("2026-02-29")).toBe(false);
    expect(isCalendarDate("2028-02-29")).toBe(true);
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("2026-1-01")).toBe(false);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays(d("2026-12-31"), 1)).toBe("2027-01-01");
    expect(addDays(d("2026-03-01"), -1)).toBe("2026-02-28");
  });

  it("clamps month arithmetic", () => {
    expect(addMonthsClamped(d("2026-01-31"), 1)).toBe("2026-02-28");
    expect(addMonthsClamped(d("2028-01-31"), 1)).toBe("2028-02-29");
    expect(addMonthsClamped(d("2026-11-15"), 3)).toBe("2027-02-15");
    expect(addMonthsClamped(d("2026-03-15"), -3)).toBe("2025-12-15");
  });

  it("knows weekdays and week starts", () => {
    expect(weekday(d("2026-10-01"))).toBe(4); // Thursday
    expect(startOfWeek(d("2026-10-01"), 1)).toBe("2026-09-28");
    expect(startOfWeek(d("2026-10-01"), 0)).toBe("2026-09-27");
    expect(startOfWeek(d("2026-09-28"), 1)).toBe("2026-09-28");
  });

  it("round-trips Postgres date columns", () => {
    expect(fromDbDate(toDbDate(d("2026-10-01")))).toBe("2026-10-01");
  });
});

describe("timezones", () => {
  it("computes offsets including half-hour zones", () => {
    expect(tzOffsetMinutes(new Date("2026-10-01T12:00:00Z"), "Asia/Tehran")).toBe(210);
    expect(tzOffsetMinutes(new Date("2026-07-01T12:00:00Z"), "America/New_York")).toBe(-240);
    expect(tzOffsetMinutes(new Date("2026-01-01T12:00:00Z"), "America/New_York")).toBe(-300);
  });

  it("derives the local date of an instant", () => {
    const instant = new Date("2026-10-01T22:30:00Z");
    expect(localDate(instant, "UTC")).toBe("2026-10-01");
    expect(localDate(instant, "Asia/Tehran")).toBe("2026-10-02");
    expect(localDate(instant, "America/Los_Angeles")).toBe("2026-10-01");
  });

  it("converts wall time to UTC", () => {
    expect(zonedToUtc(d("2026-10-01"), 9 * 60, "Asia/Tehran").toISOString()).toBe("2026-10-01T05:30:00.000Z");
    expect(zonedToUtc(d("2026-07-01"), 9 * 60, "America/New_York").toISOString()).toBe("2026-07-01T13:00:00.000Z");
  });

  it("shifts nonexistent spring-forward times past the gap", () => {
    // 2026-03-08 02:30 does not exist in New York (clocks jump 02:00 → 03:00).
    expect(zonedToUtc(d("2026-03-08"), 2 * 60 + 30, "America/New_York").toISOString()).toBe("2026-03-08T07:30:00.000Z");
  });

  it("picks the earlier instant for ambiguous fall-back times", () => {
    // 2026-11-01 01:30 happens twice in New York; the first is EDT (UTC-4).
    expect(zonedToUtc(d("2026-11-01"), 90, "America/New_York").toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });
});
