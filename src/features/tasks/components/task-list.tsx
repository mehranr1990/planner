"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
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

export interface TaskSelection {
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

export interface TaskReorder {
  onReorder: (taskId: string, beforeId: string | null, afterId: string | null) => void;
}

/**
 * `reorder` is only meaningful when the view renders tasks as a single flat, sortOrder-governed
 * group (inbox/someday/all/project — see queries.ts's `viewOrder`); `groupTasks` above already
 * returns exactly one group for those views, so passing `reorder` elsewhere would be a silent
 * no-op (the DnD wrapper only ever applies to a lone group) rather than corrupting anything.
 */
export function TaskList({
  view,
  tasks,
  today,
  timezone,
  showContext,
  empty,
  selection,
  reorder,
}: {
  view: PlannerView | "project";
  tasks: TaskListItem[];
  today: CalendarDate;
  timezone: string;
  showContext: boolean;
  empty: { title: string; hint: string };
  selection?: TaskSelection;
  reorder?: TaskReorder;
}) {
  const t = useTranslations("tasks.groups");
  const f = useFormat();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  if (tasks.length === 0) return <EmptyState title={empty.title} hint={empty.hint} />;
  const groups = groupTasks(view, tasks, today, (k) => t(k), f);

  function handleDragEnd(group: Group, event: DragEndEvent) {
    if (!reorder) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = group.tasks.map((task) => task.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    const beforeId = ids[to - (to > from ? 0 : 1)] ?? null;
    const afterId = ids[to + (to > from ? 1 : 0)] ?? null;
    reorder.onReorder(String(active.id), beforeId, afterId);
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g, gi) => {
        const list = (
          <ul className="flex flex-col">
            {g.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                today={today}
                timezone={timezone}
                showContext={showContext}
                selection={selection && { checked: selection.selectedIds.has(task.id), onToggle: () => selection.onToggle(task.id) }}
                sortable={!!reorder}
              />
            ))}
          </ul>
        );
        return (
          <section key={g.key} aria-label={g.label || undefined} className="animate-rise" style={{ "--i": gi } as React.CSSProperties}>
            {g.label && (
              <h3 className={`mb-1 px-3 text-[12.5px] font-medium ${g.tone === "danger" ? "text-accent-red" : "text-foreground-muted"}`}>
                {g.label} <span className="tabular text-foreground-subtle">· {f.number(g.tasks.length)}</span>
              </h3>
            )}
            {reorder ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(g, e)}>
                <SortableContext items={g.tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
                  {list}
                </SortableContext>
              </DndContext>
            ) : (
              list
            )}
          </section>
        );
      })}
    </div>
  );
}
