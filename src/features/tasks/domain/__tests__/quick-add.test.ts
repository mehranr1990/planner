import { describe, expect, it } from "vitest";
import { calendarDate as d } from "@/lib/time";
import { parseQuickAdd } from "../quick-add";

const today = d("2026-10-01"); // Thursday

describe("parseQuickAdd", () => {
  it("keeps plain titles untouched", () => {
    const r = parseQuickAdd("Buy milk", today);
    expect(r).toMatchObject({ title: "Buy milk", dueOn: null, dueTime: null, priority: null, isSomeday: false });
  });

  it("parses dates, times and priority", () => {
    const r = parseQuickAdd("Pay rent tomorrow 9am !high", today);
    expect(r).toMatchObject({ title: "Pay rent", dueOn: "2026-10-02", dueTime: 540, priority: "HIGH" });
    expect(r.tokens.map((t) => t.kind)).toEqual(["date", "time", "priority"]);
  });

  it("weekday names resolve to the next occurrence, never today", () => {
    expect(parseQuickAdd("Review fri", today).dueOn).toBe("2026-10-02");
    expect(parseQuickAdd("Review thu", today).dueOn).toBe("2026-10-08");
    expect(parseQuickAdd("Plan next week", today).dueOn).toBe("2026-10-05");
  });

  it("handles 24h and 'at' times", () => {
    expect(parseQuickAdd("Call at 14:30", today)).toMatchObject({ title: "Call", dueTime: 870, dueOn: "2026-10-01" });
    expect(parseQuickAdd("Lunch 12pm", today).dueTime).toBe(720);
    expect(parseQuickAdd("Night 12am", today).dueTime).toBe(0);
  });

  it("does not treat bare numbers as times", () => {
    expect(parseQuickAdd("Read chapter 3", today)).toMatchObject({ title: "Read chapter 3", dueTime: null });
  });

  it("parks someday items", () => {
    expect(parseQuickAdd("Learn piano someday", today)).toMatchObject({ title: "Learn piano", isSomeday: true, dueOn: null });
  });

  it("only treats 'later' as a keyword at the end", () => {
    expect(parseQuickAdd("Later next week", today)).toMatchObject({ title: "Later", isSomeday: false, dueOn: "2026-10-05" });
    expect(parseQuickAdd("Call the bank later", today)).toMatchObject({ title: "Call the bank", isSomeday: true });
  });

  it("protects quoted text", () => {
    expect(parseQuickAdd('Watch "Tomorrow Never Dies" fri', today)).toMatchObject({ title: "Watch Tomorrow Never Dies", dueOn: "2026-10-02" });
  });

  it("only consumes the first date keyword", () => {
    expect(parseQuickAdd("Move today meeting tomorrow", today)).toMatchObject({ title: "Move meeting tomorrow", dueOn: "2026-10-01" });
  });

  it("passes Persian titles through untouched, including ZWNJ", () => {
    const title = "خرید کتاب‌ها برای کلاس";
    expect(parseQuickAdd(title, today)).toMatchObject({ title, dueOn: null, priority: null });
  });

  it("still recognises English keywords around Persian text (parser is English-only)", () => {
    expect(parseQuickAdd("پرداخت اجاره tomorrow 9am !high", today)).toMatchObject({
      title: "پرداخت اجاره",
      dueOn: "2026-10-02",
      dueTime: 540,
      priority: "HIGH",
    });
  });

  it("does not claim Persian keywords (فردا is kept as title text)", () => {
    expect(parseQuickAdd("جلسه فردا", today)).toMatchObject({ title: "جلسه فردا", dueOn: null });
  });
});
