import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/surface";
import { useFormat, type Format } from "@/i18n/use-format";
import { compareDates, type CalendarDate } from "@/lib/time";
import type { PlannerView } from "../domain/planner-views";
import type { TaskListItem } from "../types";
import { TaskRow } from "./task-row";

interface Group {
  key: string;
  label: string;
  tone?: "danger";
  tasks: TaskListItem[];
}

type GroupLabel = (key: "overdue" | "today" | "open" | "done" | "noDate") => string;

function groupTasks(view: PlannerView | "project", tasks: TaskListItem[], today: CalendarDate, label: GroupLabel, f: Format): Group[] {
  if (view === "today") {
    const overdue = tasks.filter((t) => t.dueOn && compareDates(t.dueOn, today) < 0);
    const rest = tasks.filter((t) => !overdue.includes(t));
    return [
      { key: "overdue", label: label("overdue"), tone: "danger" as const, tasks: overdue },
      { key: "today", label: label("today"), tasks: rest },
    ].filter((g) => g.tasks.length > 0);
  }
  if (view === "upcoming" || view === "scheduled" || view === "overdue") {
    const groups = new Map<string, Group>();
    for (const t of tasks) {
      const key = t.dueOn ?? "none";
      if (!groups.has(key)) groups.set(key, { key, label: t.dueOn ? f.relativeDay(t.dueOn, today) : label("noDate"), tasks: [] });
      groups.get(key)!.tasks.push(t);
    }
    return [...groups.values()];
  }
  if (view === "project") {
    const open = tasks.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED");
    const done = tasks.filter((t) => t.status === "DONE");
    return [
      { key: "open", label: label("open"), tasks: open },
      { key: "done", label: label("done"), tasks: done },
    ].filter((g) => g.tasks.length > 0);
  }
  return [{ key: "all", label: "", tasks }];
}

export function TaskList({
  view,
  tasks,
  today,
  timezone,
  showContext,
  empty,
}: {
  view: PlannerView | "project";
  tasks: TaskListItem[];
  today: CalendarDate;
  timezone: string;
  showContext: boolean;
  empty: { title: string; hint: string };
}) {
  const t = useTranslations("tasks.groups");
  const f = useFormat();
  if (tasks.length === 0) return <EmptyState title={empty.title} hint={empty.hint} />;
  const groups = groupTasks(view, tasks, today, (k) => t(k), f);
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g, gi) => (
        <section key={g.key} aria-label={g.label || undefined} className="animate-rise" style={{ "--i": gi } as React.CSSProperties}>
          {g.label && (
            <h3 className={`mb-1 px-3 text-[12.5px] font-medium ${g.tone === "danger" ? "text-accent-red" : "text-foreground-muted"}`}>
              {g.label} <span className="tabular text-foreground-subtle">· {f.number(g.tasks.length)}</span>
            </h3>
          )}
          <ul className="flex flex-col">
            {g.tasks.map((task) => (
              <TaskRow key={task.id} task={task} today={today} timezone={timezone} showContext={showContext} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
