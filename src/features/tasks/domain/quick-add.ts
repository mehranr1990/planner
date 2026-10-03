import { addDays, weekday, type CalendarDate } from "@/lib/time";

export type ParsedPriority = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface QuickAddResult {
  title: string;
  dueOn: CalendarDate | null;
  /** Minutes after local midnight. */
  dueTime: number | null;
  priority: ParsedPriority | null;
  isSomeday: boolean;
  /** The tokens that were recognised, for the preview chips. */
  tokens: { kind: "date" | "time" | "priority" | "someday"; text: string }[];
}

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const PRIORITIES: Record<string, ParsedPriority> = {
  "!urgent": "URGENT", "!1": "URGENT", "!!!!": "URGENT",
  "!high": "HIGH", "!2": "HIGH", "!!!": "HIGH",
  "!medium": "MEDIUM", "!med": "MEDIUM", "!3": "MEDIUM", "!!": "MEDIUM",
  "!low": "LOW", "!4": "LOW",
};

const TIME_RE = /^(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i;

function parseTime(text: string): number | null {
  const m = TIME_RE.exec(text);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const mer = m[3]?.toLowerCase();
  // Bare numbers ("call mom 3") are too ambiguous to treat as times.
  if (!m[2] && !mer) return null;
  if (min > 59) return null;
  if (mer) {
    if (h < 1 || h > 12) return null;
    if (mer === "pm" && h !== 12) h += 12;
    if (mer === "am" && h === 12) h = 0;
  } else if (h > 23) return null;
  return h * 60 + min;
}

/**
 * Parses compact natural input: "Pay rent tomorrow 9am !high", "Plan trip someday",
 * "Review PR fri", "Standup next week". Only trailing/standalone keywords are consumed so
 * titles like "Read 'Tomorrow, and Tomorrow'" survive when quoted.
 * Unrecognised text is always kept in the title — the parser never drops user words silently.
 */
export function parseQuickAdd(input: string, today: CalendarDate): QuickAddResult {
  const result: QuickAddResult = { title: "", dueOn: null, dueTime: null, priority: null, isSomeday: false, tokens: [] };
  const quoted: string[] = [];
  const protectedInput = input.replace(/"([^"]*)"/g, (_, inner: string) => {
    quoted.push(inner);
    return `\u0000${quoted.length - 1}\u0000`;
  });
  const words = protectedInput.trim().split(/\s+/).filter(Boolean);
  const kept: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const raw = words[i]!;
    const w = raw.toLowerCase();
    const next = words[i + 1]?.toLowerCase();

    if (PRIORITIES[w] && result.priority === null) {
      result.priority = PRIORITIES[w]!;
      result.tokens.push({ kind: "priority", text: raw });
      continue;
    }
    // "later" is a common title word ("Later: call bank"), so it only counts as the final word.
    const isSomedayWord = w === "someday" || (w === "later" && i === words.length - 1);
    if (isSomedayWord && !result.isSomeday && result.dueOn === null) {
      result.isSomeday = true;
      result.tokens.push({ kind: "someday", text: raw });
      continue;
    }
    if (result.dueOn === null && !result.isSomeday) {
      if (w === "today" || w === "tod") {
        result.dueOn = today;
        result.tokens.push({ kind: "date", text: raw });
        continue;
      }
      if (w === "tomorrow" || w === "tmr" || w === "tmrw") {
        result.dueOn = addDays(today, 1);
        result.tokens.push({ kind: "date", text: raw });
        continue;
      }
      if (w === "next" && next === "week") {
        // Next Monday.
        result.dueOn = addDays(today, ((1 - weekday(today) + 7) % 7) || 7);
        result.tokens.push({ kind: "date", text: `${raw} ${words[i + 1]}` });
        i++;
        continue;
      }
      const wd = WEEKDAYS[w];
      if (wd !== undefined) {
        const delta = ((wd - weekday(today) + 7) % 7) || 7; // "fri" on a Friday means next Friday
        result.dueOn = addDays(today, delta);
        result.tokens.push({ kind: "date", text: raw });
        continue;
      }
    }
    if (result.dueTime === null) {
      const joined = w === "at" && next ? `${w} ${next}` : w;
      const minutes = parseTime(joined);
      if (minutes !== null) {
        result.dueTime = minutes;
        result.tokens.push({ kind: "time", text: w === "at" ? `${raw} ${words[i + 1]}` : raw });
        if (w === "at") i++;
        continue;
      }
    }
    kept.push(raw);
  }

  // A time with no date means today (or tomorrow is ambiguous — keep it simple and explicit).
  if (result.dueTime !== null && result.dueOn === null) {
    result.dueOn = today;
    result.isSomeday = false;
  }

  result.title = kept
    .join(" ")
    .replace(/\u0000(\d+)\u0000/g, (_, idx: string) => quoted[Number(idx)] ?? "")
    .trim();
  return result;
}
