"use client";

import { Check, CheckSquare, Flag, Repeat, Workflow } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { PeopleCluster } from "@/components/ui/people-cluster";
import { Dot, toneOf } from "@/components/ui/data-viz";
import { useFormat } from "@/i18n/use-format";
import { cn } from "@/lib/cn";
import type { CalendarDate } from "@/lib/time";
import { setTaskCompletionAction } from "../server/actions";
import type { TaskListItem } from "../types";

const PRIORITY_TONE = { URGENT: "text-accent-red", HIGH: "text-accent-red", MEDIUM: "text-accent-yellow", LOW: "text-accent-blue", NONE: "" } as const;

export function TaskRow({
  task,
  today,
  timezone,
  showContext,
}: {
  task: TaskListItem;
  today: CalendarDate;
  timezone: string;
  showContext: boolean;
}) {
  const t = useTranslations("tasks");
  const f = useFormat();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useOptimistic(task.status === "DONE");

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
    <li className="group relative flex items-start gap-3 rounded-[18px] px-3 py-3 transition-colors hover:bg-surface-elevated">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? t("row.reopen", { title: task.title }) : t("row.complete", { title: task.title })}
        disabled={!task.canEdit || pending}
        onClick={toggle}
        className={cn(
          "relative z-10 mt-0.5 inline-flex size-[22px] shrink-0 items-center justify-center rounded-full ring-[1.5px] transition-colors",
          done ? "bg-surface-active text-foreground-on-active ring-surface-active" : "ring-border-strong hover:ring-foreground-muted",
          task.priority === "URGENT" && !done && "ring-accent-red",
        )}
      >
        {done && <Check className="size-3.5" strokeWidth={2.5} aria-hidden />}
      </button>
      <div className="min-w-0 flex-1">
        <Link href={href} scroll={false} className="block truncate text-[14.5px] leading-[22px] after:absolute after:inset-0 after:rounded-[18px]">
          {/* User content keeps its own direction regardless of the UI language. */}
          <span dir="auto" className={cn(done && "text-foreground-subtle line-through decoration-foreground-subtle/60")}>
            {task.title}
          </span>
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-foreground-muted">
          {dueLabel && (
            <span className={cn(overdue && "text-accent-red")}>
              {dueLabel}
              {task.dueAt && ` · ${f.time(new Date(task.dueAt), timezone)}`}
            </span>
          )}
          {task.isSomeday && <span>{t("row.someday")}</span>}
          {task.project && (
            <span className="inline-flex items-center gap-1.5">
              <Dot tone={toneOf(task.project.color)} />
              <span dir="auto">{task.project.name}</span>
            </span>
          )}
          {showContext && task.context.kind === "workspace" && <span dir="auto">{task.context.name}</span>}
          {task.isRecurring && <Repeat className="size-3.5" aria-label={t("row.repeats")} />}
          {task.subtaskCount > 0 && (
            <span className="inline-flex items-center gap-1" aria-label={t("row.subtasks", { count: task.subtaskCount })}>
              <Workflow className="size-3.5" aria-hidden /> {f.number(task.subtaskCount)}
            </span>
          )}
          {task.checklist.total > 0 && (
            <span className="tabular inline-flex items-center gap-1" aria-label={t("row.checklist", { done: task.checklist.done, total: task.checklist.total })}>
              <CheckSquare className="size-3.5" aria-hidden /> {f.number(task.checklist.done)}/{f.number(task.checklist.total)}
            </span>
          )}
          {task.priority !== "NONE" && !done && (
            <span className={cn("inline-flex items-center gap-1", PRIORITY_TONE[task.priority])}>
              <Flag className="size-3.5" aria-hidden /> {t(`priority.${task.priority}`)}
            </span>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-1 text-[12.5px] text-accent-red">
            {error}
          </p>
        )}
      </div>
      {task.assignees.length > 0 && (
        <div className="relative shrink-0 self-center">
          <PeopleCluster people={task.assignees} total={task.assigneeCount} size="xs" max={3} label={t("row.assignees")} />
        </div>
      )}
    </li>
  );
}
