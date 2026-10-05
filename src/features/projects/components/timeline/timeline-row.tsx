import Link from "next/link";
import { toneOf } from "@/components/ui/data-viz";
import type { TaskListItem } from "@/features/tasks/types";

const TONE_CLASS: Record<string, string> = {
  blue: "bg-accent-blue",
  red: "bg-accent-red",
  yellow: "bg-accent-yellow",
  green: "bg-accent-green",
  peach: "bg-accent-peach",
  slate: "bg-foreground-subtle",
};

/**
 * One task's row: a label cell (column 1) and a bar spanning `[startIndex, endIndex]` (columns
 * 2…dayCount+1) — both rendered as direct children of the parent CSS grid via a Fragment, so they
 * share the same grid as the date-scale header row above them. Every item in this row gets the
 * SAME explicit `gridRow` (grid auto-placement can't be trusted to align a day-cell background and
 * a task bar into the same cell — only explicit placement on both axes allows that overlap), and
 * the same fixed height, so the row renders as one visual line regardless of how many day-cells or
 * bars occupy it. A single-day task (only a due date, or start === due) renders as a one-day
 * marker, never a zero-width sliver (`startIndex === endIndex` is a valid, visible 1-day pill).
 */
export function TimelineRow({
  task,
  rowIndex,
  startIndex,
  endIndex,
  dayCount,
  todayIndex,
}: {
  task: TaskListItem;
  rowIndex: number;
  startIndex: number;
  endIndex: number;
  dayCount: number;
  todayIndex: number;
}) {
  const row = rowIndex + 2; // row 1 is the date-scale header
  const done = task.status === "DONE";
  const overdue = !done && task.isOverdue;
  const barTone = toneOf(task.project?.color ?? "blue");

  return (
    <>
      <Link
        href={{ query: { task: task.id } }}
        scroll={false}
        style={{ gridColumn: "1 / 2", gridRow: row }}
        className="flex h-9 min-w-0 items-center truncate border-b border-border-subtle pe-3 text-[13px] hover:underline"
      >
        <span dir="auto" className={done ? "text-foreground-subtle line-through" : overdue ? "text-accent-red" : undefined}>
          {task.title}
        </span>
      </Link>
      {Array.from({ length: dayCount }, (_, i) => (
        <div key={i} style={{ gridColumn: `${i + 2} / ${i + 3}`, gridRow: row }} className={`h-9 border-b border-border-subtle ${i === todayIndex ? "bg-accent-blue-soft/20" : ""}`} />
      ))}
      <Link
        href={{ query: { task: task.id } }}
        scroll={false}
        aria-label={task.title}
        style={{ gridColumn: `${startIndex + 2} / ${endIndex + 3}`, gridRow: row }}
        className="flex h-9 items-center px-0.5"
      >
        <div className={`h-2.5 w-full rounded-full ${done ? "bg-foreground-subtle opacity-50" : TONE_CLASS[barTone]} ${overdue ? "ring-2 ring-accent-red" : ""}`} />
      </Link>
    </>
  );
}
