"use client";

import { Bell, BellOff, Check, Plus, RotateCcw, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { Chip, toneOf } from "@/components/ui/data-viz";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { LabelPicker, type LabelOption } from "@/components/ui/label-picker";
import type { PersonRef } from "@/components/ui/people";
import { PeopleCluster } from "@/components/ui/people-cluster";
import { PeoplePicker } from "@/components/ui/people-picker";
import { Sheet } from "@/components/ui/sheet";
import { useFormat } from "@/i18n/use-format";
import { cn } from "@/lib/cn";
import type { CalendarDate } from "@/lib/time";
import { createLabelAction } from "@/features/labels/server/actions";
import type { CommentItem } from "@/features/collaboration/types";
import type { MilestoneOption } from "@/features/milestones/types";
import type { ReminderDetail } from "@/features/reminders/types";
import { CommentsSection } from "./comments-section";
import { DependencyPicker } from "./dependency-picker";
import { ReminderControl } from "./reminder-control";
import { SubtaskList } from "./subtask-list";
import {
  addChecklistItemAction,
  createSubtaskAction,
  deleteTaskAction,
  setTaskAssigneesAction,
  setTaskCompletionAction,
  setTaskLabelsAction,
  setTaskRecurrenceAction,
  toggleChecklistItemAction,
  unwatchTaskAction,
  updateTaskAction,
  watchTaskAction,
} from "../server/actions";
import type { RecurrencePreset, TaskDetail, TaskPriority } from "../types";

const PRESETS: RecurrencePreset[] = ["none", "daily", "weekdays", "weekly", "monthly", "yearly"];
const PRIORITIES: TaskPriority[] = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"];
const KNOWN_ACTIVITY = new Set([
  "created",
  "updated",
  "completed",
  "reopened",
  "deleted",
  "restored",
  "recurred",
  "recurrence_set",
  "recurrence_removed",
  "dependency_added",
  "dependency_removed",
  "assignees_changed",
  "labels_changed",
  "watching",
  "unwatching",
  "subtask_created",
  "comment_created",
  "comment_edited",
  "comment_deleted",
  "reminder_created",
  "reminder_updated",
  "reminder_removed",
  "status_changed",
  "schedule_changed",
  "section_changed",
  "milestone_changed",
] as const);
type ActivityKey = typeof KNOWN_ACTIVITY extends Set<infer K> ? K : never;

function toTimeInput(minutes: number | null) {
  if (minutes === null) return "";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function fromTimeInput(value: string): number | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function TaskSheet({
  task,
  projects,
  members,
  labelOptions,
  milestoneOptions,
  comments,
  mentionCandidates,
  currentUser,
  reminder,
  today,
  timezone,
}: {
  task: TaskDetail;
  projects: { id: string; name: string; workspaceId: string | null }[];
  /** Workspace members selectable as assignees; empty for personal tasks. */
  members: PersonRef[];
  /** Labels usable on this task's own scope (that workspace, or the viewer's personal labels). */
  labelOptions: LabelOption[];
  /** Milestones of the task's *current* (saved) project; empty for a task with no project or no milestones yet. */
  milestoneOptions: MilestoneOption[];
  /** This task's comment thread (one level of replies). */
  comments: CommentItem[];
  /** Users @mentionable in this task's comments — already visibility-filtered server-side. */
  mentionCandidates: PersonRef[];
  /** The signed-in viewer, for attributing new comments optimistically. */
  currentUser: PersonRef;
  /** The viewer's own reminder on this task, if any. */
  reminder: ReminderDetail | null;
  /** Server-computed "today" in the viewer's timezone, for reminder display and defaults. */
  today: CalendarDate;
  /** Viewer's timezone — activity times render identically on server and client. */
  timezone: string;
}) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const f = useFormat();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [optimisticAssigneeIds, setOptimisticAssigneeIds] = useOptimistic(task.assignees.map((a) => a.id));
  const [optimisticLabelIds, setOptimisticLabelIds] = useOptimistic(task.labels.map((l) => l.id));
  const [optimisticWatching, setOptimisticWatching] = useOptimistic(task.isWatching);

  const close = () => {
    const next = new URLSearchParams(params);
    next.delete("task");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const openTask = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("task", id);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? null);
      else after?.();
    });
  };

  const sameSpaceProjects = projects.filter((p) => p.workspaceId === (task.context.kind === "workspace" ? task.context.id : null));
  const done = task.status === "DONE";
  const readOnly = !task.canEdit;
  const canAssign = task.canAssign && task.context.kind === "workspace";

  const onSave = (form: FormData) => {
    const dueOn = String(form.get("dueOn") ?? "");
    const startOn = String(form.get("startOn") ?? "");
    run(
      () =>
        updateTaskAction({
          taskId: task.id,
          expectedVersion: task.version,
          title: String(form.get("title") ?? ""),
          description: String(form.get("description") ?? "") || null,
          priority: String(form.get("priority")) as TaskPriority,
          dueOn: (dueOn || null) as CalendarDate | null,
          dueTime: dueOn ? fromTimeInput(String(form.get("dueTime") ?? "")) : null,
          startOn: (startOn || null) as CalendarDate | null,
          startTime: startOn ? fromTimeInput(String(form.get("startTime") ?? "")) : null,
          isSomeday: form.get("isSomeday") === "on",
          projectId: String(form.get("projectId") ?? "") || null,
          milestoneId: task.project ? String(form.get("milestoneId") ?? "") || null : undefined,
        }),
      () => setSaved(true),
    );
  };

  return (
    <Sheet title={task.title} onClose={close}>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Chip tone={task.context.kind === "workspace" ? "blue" : "slate"}>
          {task.context.kind === "workspace" ? <span dir="auto">{task.context.name}</span> : tc("personal")}
        </Chip>
        {done && <Chip tone="green">{t("sheet.completedChip")}</Chip>}
        {!done && task.isBlocked && <Chip tone="red">{t("sheet.blockedChip")}</Chip>}
        {task.recurrence && <Chip tone="yellow">{t("sheet.repeatsChip", { preset: task.recurrence.preset })}</Chip>}
        <div className="ms-auto flex items-center gap-2">
          <IconButton
            label={optimisticWatching ? t("sheet.unwatch") : t("sheet.watch")}
            active={optimisticWatching}
            disabled={pending}
            onClick={() =>
              start(async () => {
                setOptimisticWatching(!optimisticWatching);
                const res = optimisticWatching ? await unwatchTaskAction({ taskId: task.id }) : await watchTaskAction({ taskId: task.id });
                if (!res.ok) setError(res.error ?? null);
              })
            }
          >
            {optimisticWatching ? <Bell className="size-[18px]" aria-hidden /> : <BellOff className="size-[18px]" aria-hidden />}
          </IconButton>
          {task.assignees.length > 0 && <PeopleCluster people={task.assignees} total={task.assigneeCount} size="sm" max={3} label={t("sheet.assignees")} />}
        </div>
      </div>

      <form action={onSave} className="flex flex-col gap-4">
        <fieldset disabled={readOnly || pending} className="flex flex-col gap-4">
          <legend className="sr-only">{t("sheet.details")}</legend>
          <label htmlFor="task-title" className="sr-only">
            {t("sheet.title")}
          </label>
          <input
            id="task-title"
            name="title"
            dir="auto"
            defaultValue={task.title}
            required
            maxLength={500}
            className="w-full bg-transparent text-[22px] leading-8 font-medium tracking-[-0.01em] focus:outline-none"
          />
          <Field label={t("sheet.notes")} htmlFor="task-description">
            <Textarea id="task-description" name="description" dir="auto" defaultValue={task.description ?? ""} placeholder={t("sheet.notesPlaceholder")} />
          </Field>
          {/* One column, labels at the start (reference form). Date and time share one label/row. */}
          <Field label={t("sheet.startDate")} htmlFor="task-start" hint={t("sheet.timeHint")}>
            <div className="flex gap-3">
              <div className="min-w-0 flex-1">
                <Input id="task-start" name="startOn" type="date" defaultValue={task.startOn ?? ""} />
              </div>
              <div className="w-36 shrink-0">
                <label htmlFor="task-start-time" className="sr-only">
                  {t("sheet.time")}
                </label>
                <Input id="task-start-time" name="startTime" type="time" defaultValue={toTimeInput(task.startTime)} />
              </div>
            </div>
          </Field>
          <Field label={t("sheet.dueDate")} htmlFor="task-due" hint={t("sheet.timeHint")}>
            {/* Sizes live on wrappers: Input is w-full by design. */}
            <div className="flex gap-3">
              <div className="min-w-0 flex-1">
                <Input id="task-due" name="dueOn" type="date" defaultValue={task.dueOn ?? ""} />
              </div>
              <div className="w-36 shrink-0">
                <label htmlFor="task-time" className="sr-only">
                  {t("sheet.time")}
                </label>
                <Input id="task-time" name="dueTime" type="time" defaultValue={toTimeInput(task.dueTime)} />
              </div>
            </div>
          </Field>
          <Field label={t("sheet.priority")} htmlFor="task-priority">
            <Select id="task-priority" name="priority" defaultValue={task.priority}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {t(`priority.${p}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("sheet.project")} htmlFor="task-project">
            <Select id="task-project" name="projectId" defaultValue={task.project?.id ?? ""}>
              <option value="">{t("sheet.noProject")}</option>
              {sameSpaceProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          {task.project && milestoneOptions.length > 0 && (
            <Field label={t("sheet.milestone")} htmlFor="task-milestone">
              <Select id="task-milestone" name="milestoneId" defaultValue={task.milestoneId ?? ""}>
                <option value="">{t("sheet.noMilestone")}</option>
                {milestoneOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <label className="flex items-center gap-3 px-1 text-sm">
            <input type="checkbox" name="isSomeday" defaultChecked={task.isSomeday} className="size-4 accent-[var(--surface-active)]" />
            {t("sheet.someday")}
          </label>
        </fieldset>

        {error && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-[16px] bg-accent-red-soft/40 px-4 py-3 text-[13px]">
            <span>{error}</span>
            <Button size="sm" variant="secondary" onClick={() => router.refresh()}>
              {tc("actions.reload")}
            </Button>
          </div>
        )}

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="primary" disabled={pending}>
              {t("sheet.save")}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => run(() => setTaskCompletionAction({ taskId: task.id, done: !done }))}>
              {done ? <RotateCcw className="size-4" aria-hidden /> : <Check className="size-4" aria-hidden />}
              {done ? t("sheet.reopen") : t("sheet.complete")}
            </Button>
            {saved && (
              <span role="status" className="text-[12.5px] text-foreground-muted">
                {t("sheet.saved")}
              </span>
            )}
          </div>
        )}
      </form>

      {canAssign && (
        <section aria-labelledby="assignees-heading" className="mt-8">
          <h3 id="assignees-heading" className="mb-2 px-1 text-[12.5px] text-foreground-muted">
            {t("sheet.assignees")}
          </h3>
          <PeoplePicker
            people={members}
            selected={optimisticAssigneeIds}
            label={t("sheet.assignees")}
            placeholder={t("sheet.assigneesPlaceholder")}
            onChange={(ids) =>
              start(async () => {
                setOptimisticAssigneeIds(ids);
                const res = await setTaskAssigneesAction({ taskId: task.id, userIds: ids });
                if (!res.ok) setError(res.error ?? null);
              })
            }
          />
        </section>
      )}

      <section aria-labelledby="labels-heading" className="mt-8">
        <h3 id="labels-heading" className="mb-2 px-1 text-[12.5px] text-foreground-muted">
          {t("sheet.labels")}
        </h3>
        {readOnly ? (
          task.labels.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5 px-1">
              {task.labels.map((l) => (
                <li key={l.id}>
                  <Chip tone={toneOf(l.color)}>
                    <span dir="auto">{l.name}</span>
                  </Chip>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 text-[13px] text-foreground-subtle">{t("sheet.labelsNone")}</p>
          )
        ) : (
          <LabelPicker
            labels={labelOptions}
            selected={optimisticLabelIds}
            label={t("sheet.labels")}
            placeholder={t("sheet.labelsPlaceholder")}
            onChange={(ids) =>
              start(async () => {
                setOptimisticLabelIds(ids);
                const res = await setTaskLabelsAction({ taskId: task.id, labelIds: ids });
                if (!res.ok) setError(res.error ?? null);
              })
            }
            onCreate={async (name, color) => {
              const context = task.context.kind === "workspace" ? task.context.id : "personal";
              const res = await createLabelAction({ context, name, color });
              if (!res.ok) {
                setError(res.error ?? null);
                return null;
              }
              return res.data;
            }}
          />
        )}
      </section>

      <section aria-labelledby="subtasks-heading" className="mt-8">
        <h3 id="subtasks-heading" className="mb-2 px-1 text-[12.5px] text-foreground-muted">
          {t("sheet.subtasks")}
        </h3>
        <SubtaskList subtasks={task.subtasks} onOpen={openTask} />
        {!readOnly && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const title = newSubtask.trim();
              if (!title) return;
              run(() => createSubtaskAction({ parentTaskId: task.id, title }), () => setNewSubtask(""));
            }}
            className="mt-1 flex items-center gap-2 px-1"
          >
            <label htmlFor="subtask-new" className="sr-only">
              {t("sheet.subtasksNew")}
            </label>
            <Input id="subtask-new" dir="auto" value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} placeholder={t("sheet.subtasksPlaceholder")} maxLength={500} />
            <IconButton type="submit" size="lg" label={t("sheet.subtasksAdd")} disabled={!newSubtask.trim() || pending} className="bg-surface-elevated">
              <Plus className="size-4" aria-hidden />
            </IconButton>
          </form>
        )}
      </section>

      <section aria-labelledby="dependencies-heading" className="mt-8">
        <h3 id="dependencies-heading" className="mb-2 px-1 text-[12.5px] text-foreground-muted">
          {t("sheet.dependencies.heading")}
        </h3>
        <DependencyPicker taskId={task.id} blockedBy={task.blockedBy} blocking={task.blocking} readOnly={readOnly} onError={setError} />
      </section>

      <section aria-labelledby="reminder-heading" className="mt-8">
        <h3 id="reminder-heading" className="mb-2 px-1 text-[12.5px] text-foreground-muted">
          {t("sheet.reminder.heading")}
        </h3>
        <ReminderControl taskId={task.id} reminder={reminder} dueOn={task.dueOn} today={today} timezone={timezone} onError={setError} />
      </section>

      {!readOnly && (
        <section aria-labelledby="repeat-heading" className="mt-8">
          <h3 id="repeat-heading" className="mb-2 px-1 text-[12.5px] text-foreground-muted">
            {t("sheet.repeat")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => {
              const active = (task.recurrence?.preset ?? "none") === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={active}
                  disabled={pending || (p !== "none" && !task.dueOn)}
                  onClick={() => run(() => setTaskRecurrenceAction({ taskId: task.id, preset: p, mode: task.recurrence?.mode ?? "FIXED_SCHEDULE" }))}
                  className={cn(
                    "h-8 rounded-full px-3.5 text-[13px] ring-1 transition-colors disabled:opacity-40",
                    active ? "bg-surface-active text-foreground-on-active ring-surface-active" : "bg-surface-elevated ring-border-subtle hover:ring-border-strong",
                  )}
                >
                  {t(`repeat.${p}`)}
                </button>
              );
            })}
          </div>
          {!task.dueOn && <p className="mt-2 px-1 text-[12px] text-foreground-subtle">{t("sheet.repeatNeedsDate")}</p>}
          {task.recurrence && (
            <label className="mt-3 flex items-center gap-3 px-1 text-sm">
              <input
                type="checkbox"
                checked={task.recurrence.mode === "AFTER_COMPLETION"}
                disabled={pending || task.recurrence.preset === "custom"}
                onChange={(e) =>
                  task.recurrence?.preset !== "custom" &&
                  run(() =>
                    setTaskRecurrenceAction({
                      taskId: task.id,
                      preset: task.recurrence!.preset as RecurrencePreset,
                      mode: e.target.checked ? "AFTER_COMPLETION" : "FIXED_SCHEDULE",
                    }),
                  )
                }
                className="size-4 accent-[var(--surface-active)]"
              />
              {t("sheet.afterCompletion")}
            </label>
          )}
        </section>
      )}

      <section aria-labelledby="checklist-heading" className="mt-8">
        <h3 id="checklist-heading" className="mb-2 px-1 text-[12.5px] text-foreground-muted">
          {t("sheet.checklist")}
        </h3>
        <ul className="flex flex-col gap-1">
          {task.checklistItems.map((item) => (
            <li key={item.id}>
              <label className="flex items-center gap-3 rounded-[14px] px-3 py-2 text-sm hover:bg-surface-elevated">
                <input
                  type="checkbox"
                  checked={item.isDone}
                  disabled={readOnly || pending}
                  onChange={(e) => run(() => toggleChecklistItemAction({ itemId: item.id, isDone: e.target.checked }))}
                  className="size-4 accent-[var(--surface-active)]"
                />
                <span dir="auto" className={cn(item.isDone && "text-foreground-subtle line-through")}>
                  {item.title}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {!readOnly && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const title = newItem.trim();
              if (title) run(() => addChecklistItemAction({ taskId: task.id, title }), () => setNewItem(""));
            }}
            className="mt-1 flex items-center gap-2 px-1"
          >
            <label htmlFor="checklist-new" className="sr-only">
              {t("sheet.checklistNew")}
            </label>
            <Input id="checklist-new" dir="auto" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder={t("sheet.checklistPlaceholder")} maxLength={500} />
            <IconButton type="submit" size="lg" label={t("sheet.checklistAdd")} disabled={!newItem.trim() || pending} className="bg-surface-elevated">
              <Plus className="size-4" aria-hidden />
            </IconButton>
          </form>
        )}
      </section>

      <CommentsSection taskId={task.id} comments={comments} mentionCandidates={mentionCandidates} currentUser={currentUser} timezone={timezone} />

      <section aria-labelledby="activity-heading" className="mt-8">
        <h3 id="activity-heading" className="mb-2 px-1 text-[12.5px] text-foreground-muted">
          {t("sheet.activity")}
        </h3>
        <ol className="flex flex-col gap-3 px-1">
          {task.activity.map((a) => {
            const key: ActivityKey | "other" = KNOWN_ACTIVITY.has(a.action as ActivityKey) ? (a.action as ActivityKey) : "other";
            return (
              <li key={a.id} className="flex items-center gap-3 text-[13px]">
                {a.actor && <Avatar person={a.actor} size="xs" />}
                <span>
                  {t.rich(`activity.${key}`, {
                    name: a.actor?.name ?? t("sheet.someone"),
                    actor: (chunks) => <span className="font-medium">{chunks}</span>,
                  })}
                </span>
                <time dateTime={a.createdAt} className="ms-auto shrink-0 text-[12px] text-foreground-subtle" data-volatile>
                  {f.dateTime(new Date(a.createdAt), timezone)}
                </time>
              </li>
            );
          })}
        </ol>
      </section>

      {task.canDelete && (
        <div className="mt-10 border-t border-border-subtle pt-5">
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              run(
                () => deleteTaskAction({ taskId: task.id }),
                () => {
                  // The task is no longer visible; hand over to the page-level undo banner.
                  const next = new URLSearchParams(params);
                  next.delete("task");
                  next.set("deleted", task.id);
                  router.replace(`${pathname}?${next.toString()}`, { scroll: false });
                },
              )
            }
          >
            <Trash2 className="size-4" aria-hidden /> {t("sheet.delete")}
          </Button>
        </div>
      )}
      <p className="mt-6 px-1 text-[12px] text-foreground-subtle">{t("sheet.createdBy", { name: task.createdBy.name })}</p>
    </Sheet>
  );
}
