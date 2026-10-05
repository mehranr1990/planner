import { getTranslations } from "next-intl/server";
import { getFormat } from "@/i18n/get-format";
import { addDays, compareDates, diffDays, type CalendarDate } from "@/lib/time";
import { EmptyState } from "@/components/ui/surface";
import type { TaskListItem } from "@/features/tasks/types";
import { TimelineRow } from "./timeline-row";

/**
 * Read-first Gantt-like view (Batch 5, §6–§8): date scale + task bars over `[from, to]`. No
 * drag/resize — editing a task's start/due date goes through the existing TaskSheet form (which
 * now also exposes Start date, the one schema gap this batch found: `Task.startOn`/`startAt`
 * already existed, validated and indexed, but nothing anywhere ever set it before this batch).
 * "A read-first timeline with safe date editing is better than a fragile Gantt clone."
 */
export async function TimelineView({
  tasks,
  noDateCount,
  from,
  to,
  today,
}: {
  tasks: TaskListItem[];
  noDateCount: number;
  from: CalendarDate;
  to: CalendarDate;
  today: CalendarDate;
}) {
  const t = await getTranslations("timeline");
  const f = await getFormat();
  const dayCount = diffDays(to, from) + 1;
  const days = Array.from({ length: dayCount }, (_, i) => addDays(from, i));
  const todayIndex = compareDates(today, from) >= 0 && compareDates(today, to) <= 0 ? diffDays(today, from) : -1;

  const bars = tasks.map((task) => {
    const barStart = task.startOn ?? task.dueOn!;
    const barEnd = task.dueOn ?? task.startOn!;
    const clampedStart = compareDates(barStart, from) < 0 ? from : barStart;
    const clampedEnd = compareDates(barEnd, to) > 0 ? to : barEnd;
    return { task, startIndex: diffDays(clampedStart, from), endIndex: diffDays(clampedEnd, from) };
  });

  return (
    <div>
      {tasks.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <div className="scrollbar-none -mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
          <div className="min-w-max" style={{ display: "grid", gridTemplateColumns: `200px repeat(${dayCount}, 36px)` }}>
            <div style={{ gridColumn: "1 / 2", gridRow: 1 }} className="sticky start-0 z-10 bg-surface-primary" />
            {days.map((day, i) => (
              <div
                key={day}
                style={{ gridColumn: `${i + 2} / ${i + 3}`, gridRow: 1 }}
                className={`flex flex-col items-center justify-center border-b border-border-subtle pb-1.5 text-[11px] ${i === todayIndex ? "bg-accent-blue-soft/40 font-medium text-foreground" : "text-foreground-subtle"}`}
                aria-current={i === todayIndex ? "date" : undefined}
              >
                <span>{f.date(day, { weekday: "short" })}</span>
                <span className="tabular">{f.date(day, { day: "numeric" })}</span>
              </div>
            ))}
            {bars.map(({ task, startIndex, endIndex }, rowIndex) => (
              <TimelineRow key={task.id} task={task} rowIndex={rowIndex} startIndex={startIndex} endIndex={endIndex} dayCount={dayCount} todayIndex={todayIndex} />
            ))}
          </div>
        </div>
      )}
      {noDateCount > 0 && <p className="mt-3 px-1 text-[12.5px] text-foreground-muted">{t("noDate", { count: noDateCount })}</p>}
    </div>
  );
}
