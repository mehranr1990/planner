"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, CheckSquare, Flag, GripVertical } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { Chip, toneOf } from "@/components/ui/data-viz";
import { PeopleCluster } from "@/components/ui/people-cluster";
import { useFormat } from "@/i18n/use-format";
import { cn } from "@/lib/cn";
import type { CalendarDate } from "@/lib/time";
import { setTaskCompletionAction } from "@/features/tasks/server/actions";
import type { TaskListItem } from "@/features/tasks/types";

const PRIORITY_TONE = { URGENT: "text-accent-red", HIGH: "text-accent-red", MEDIUM: "text-accent-yellow", LOW: "text-accent-blue", NONE: "" } as const;

/** Compact task card for the Board (Batch 5) — deliberately smaller than `TaskRow`: a kanban board
 * trades per-row detail for density, so this surfaces only what fits a glance (title, due date,
 * priority, assignees, subtask/checklist counts) rather than mirroring the planner row. */
export function BoardCard({ task, today, timezone, overlay = false }: { task: TaskListItem; today: CalendarDate; timezone: string; overlay?: boolean }) {
  const t = useTranslations("tasks");
  const f = useFormat();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useOptimistic(task.status === "DONE");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "card", task },
    disabled: !task.canEdit,
  });

  const href = (() => {
    const next = new URLSearchParams(params);
    next.set("task", task.id);
    return `${pathname}?${next.toString()}`;
  })();

  const toggle = () => {
    setError(null);
    start(async () => {
      setDone(!done);
      const res = await setTaskCompletionAction({ taskId: task.id, done: !done });
      if (!res.ok) setError(res.error);
    });
  };

  const overdue = !done && task.isOverdue;
  const dueLabel = task.dueOn ? f.relativeDay(task.dueOn, today) : null;

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : { transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative flex flex-col gap-2 rounded-[16px] bg-surface-secondary p-3 ring-1 ring-transparent transition-colors hover:ring-border-subtle",
        isDragging && "opacity-40",
        overlay && "rotate-1 shadow-overlay ring-border-strong",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? t("row.reopen", { title: task.title }) : t("row.complete", { title: task.title })}
          disabled={!task.canEdit || pending}
          onClick={toggle}
          className={cn(
            "relative z-10 mt-0.5 inline-flex size-[18px] shrink-0 items-center justify-center rounded-full ring-[1.5px] transition-colors",
            done ? "bg-surface-active text-foreground-on-active ring-surface-active" : "ring-border-strong hover:ring-foreground-muted",
            task.priority === "URGENT" && !done && "ring-accent-red",
          )}
        >
          {done && <Check className="size-3" strokeWidth={2.5} aria-hidden />}
        </button>
        <Link href={href} scroll={false} className="min-w-0 flex-1 after:absolute after:inset-0 after:rounded-[16px]">
          <span dir="auto" className={cn("text-[13.5px] leading-5", done && "text-foreground-subtle line-through decoration-foreground-subtle/60")}>
            {task.title}
          </span>
        </Link>
        {task.canEdit && !overlay && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={t("reorder.handle", { title: task.title })}
            className="relative z-10 shrink-0 cursor-grab touch-none text-foreground-subtle opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
          >
            <GripVertical className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-foreground-muted">
        {dueLabel && (
          <span className={cn(overdue && "text-accent-red")}>
            {dueLabel}
            {task.dueAt && ` · ${f.time(new Date(task.dueAt), timezone)}`}
          </span>
        )}
        {task.priority !== "NONE" && !done && (
          <span className={cn("inline-flex items-center gap-1", PRIORITY_TONE[task.priority])}>
            <Flag className="size-3" aria-hidden /> {t(`priority.${task.priority}`)}
          </span>
        )}
        {task.subtaskCount > 0 && (
          <span className="inline-flex items-center gap-1" aria-label={t("row.subtasks", { count: task.subtaskCount })}>
            {f.number(task.subtaskCount)}
          </span>
        )}
        {task.checklist.total > 0 && (
          <span className="tabular inline-flex items-center gap-1" aria-label={t("row.checklist", { done: task.checklist.done, total: task.checklist.total })}>
            <CheckSquare className="size-3" aria-hidden /> {f.number(task.checklist.done)}/{f.number(task.checklist.total)}
          </span>
        )}
        {task.labels.slice(0, 2).map((l) => (
          <Chip key={l.id} tone={toneOf(l.color)}>
            <span dir="auto">{l.name}</span>
          </Chip>
        ))}
      </div>
      {task.assignees.length > 0 && (
        <PeopleCluster people={task.assignees} total={task.assigneeCount} size="xs" max={3} label={t("row.assignees")} />
      )}
      {error && (
        <p role="alert" className="text-[11.5px] text-accent-red">
          {error}
        </p>
      )}
    </div>
  );
}
