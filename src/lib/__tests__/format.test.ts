import { describe, expect, it } from "vitest";
import { calendarDate as d } from "@/lib/time";
import { formatCalendarDate, formatMinutes, formatNumber, formatPercent, formatTime, relativeDayLabel } from "../format";

const en = { today: "Today", tomorrow: "Tomorrow", yesterday: "Yesterday" };
const fa = { today: "امروز", tomorrow: "فردا", yesterday: "دیروز" };
const PERSIAN_DIGITS = /[۰-۹]/;

describe("numbers", () => {
  it("uses locale digits", () => {
    expect(formatNumber(1234, "en")).toBe("1,234");
    expect(formatNumber(1234, "fa")).toMatch(PERSIAN_DIGITS);
    expect(formatNumber(1234, "fa")).not.toMatch(/[0-9]/);
  });

  it("formats percentages", () => {
    expect(formatPercent(0.33, "en")).toBe("33%");
    expect(formatPercent(0.33, "fa")).toMatch(PERSIAN_DIGITS);
  });
});

describe("dates", () => {
  it("formats floating calendar dates without a timezone shift", () => {
    expect(formatCalendarDate(d("2026-10-01"), "en")).toBe("Oct 1");
    expect(formatCalendarDate(d("2026-10-01"), "en", { month: "short", day: "numeric", year: "numeric" })).toBe("Oct 1, 2026");
  });

  it("shows Persian in the Gregorian calendar (stored dates are never re-based)", () => {
    const out = formatCalendarDate(d("2026-10-01"), "fa", { month: "long", day: "numeric", year: "numeric" });
    expect(out).toMatch(PERSIAN_DIGITS);
    expect(out).toContain("اکتبر"); // Gregorian October, not a Solar Hijri month
    expect(out).toContain("۲۰۲۶");
  });

  it("formats times in the given timezone and locale", () => {
    const instant = new Date("2026-10-01T05:30:00Z");
    expect(formatTime(instant, "Asia/Tehran", "en")).toBe("9:00 AM");
    expect(formatTime(instant, "Asia/Tehran", "fa")).toMatch(/۹:۰۰/);
    expect(formatMinutes(14 * 60 + 30, "en")).toBe("2:30 PM");
  });

  it("labels relative days from catalog strings", () => {
    const today = d("2026-10-01");
    expect(relativeDayLabel(today, today, "en", en)).toBe("Today");
    expect(relativeDayLabel(d("2026-10-02"), today, "fa", fa)).toBe("فردا");
    expect(relativeDayLabel(d("2026-09-30"), today, "fa", fa)).toBe("دیروز");
    expect(relativeDayLabel(d("2026-10-05"), today, "en", en)).toBe("Monday");
    expect(relativeDayLabel(d("2026-10-05"), today, "fa", fa)).toBe("دوشنبه");
    expect(relativeDayLabel(d("2026-11-20"), today, "en", en)).toBe("Nov 20");
    expect(relativeDayLabel(d("2027-01-04"), today, "en", en)).toBe("Jan 4, 2027");
  });
});
