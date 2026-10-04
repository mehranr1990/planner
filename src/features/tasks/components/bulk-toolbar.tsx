"use client";

import { Check, ChevronDown, RotateCcw, Tag, Trash2, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { Chip, toneOf } from "@/components/ui/data-viz";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ActionResult } from "@/lib/action-result";
import {
  bulkAddAssigneesAction,
  bulkAddLabelsAction,
  bulkDeleteAction,
  bulkMoveToProjectAction,
  bulkRemoveAssigneesAction,
  bulkRemoveLabelsAction,
  bulkSetCompletionAction,
  bulkSetDueDateAction,
  bulkSetPriorityAction,
} from "../server/actions";
import type { BulkResult } from "../server/bulk";

type Option = { id: string; name: string; color?: string };

const PRIORITIES = ["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"] as const;

/** Compact, contextual toolbar shown once ≥1 task is selected. Every action here is best-effort/
 * partial server-side (see server/bulk.ts) — this component just reports the {updated, skipped}
 * summary it gets back, never assumes every selected task was touched. */
export function BulkToolbar({
  selectedIds,
  labelOptions,
  memberOptions,
  projectOptions,
  onDone,
}: {
  selectedIds: string[];
  labelOptions: Option[];
  memberOptions: Option[];
  projectOptions: Option[];
  /** Called with the result summary on success — the parent (not this component) displays it,
   * since clearing the selection on success unmounts this toolbar in the same render pass. */
  onDone: (message: string) => void;
}) {
  const t = useTranslations("tasks.bulk");
  const [pending, start] = useTransition();
  // Only ever holds an error message now — a success message is handed to the parent via
  // `onDone`, because this component is about to unmount (selection clears on success).
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const priorityRef = useRef<HTMLDetailsElement>(null);
  const dueRef = useRef<HTMLDetailsElement>(null);
  const labelRef = useRef<HTMLDetailsElement>(null);
  const assigneeRef = useRef<HTMLDetailsElement>(null);
  const projectRef = useRef<HTMLDetailsElement>(null);

  function report(res: ActionResult<BulkResult>) {
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const { updatedIds, skippedIds } = res.data;
    const message = skippedIds.length > 0 ? t("result.partial", { updated: updatedIds.length, skipped: skippedIds.length }) : t("result.all", { updated: updatedIds.length });
    onDone(message);
  }

  function run(action: () => Promise<ActionResult<BulkResult>>) {
    setError(null);
    start(async () => report(await action()));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => bulkSetCompletionAction({ taskIds: selectedIds, done: true }))}
        className="flex h-7 items-center gap-1 rounded-full bg-surface-active px-2.5 text-[12px] text-foreground-on-active"
      >
        <Check className="size-3.5" aria-hidden /> {t("actions.complete")}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => bulkSetCompletionAction({ taskIds: selectedIds, done: false }))}
        className="flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] ring-1 ring-border-subtle hover:ring-border-strong"
      >
        <RotateCcw className="size-3.5" aria-hidden /> {t("actions.reopen")}
      </button>

      <details ref={priorityRef} className="relative">
        <summary className="flex h-7 cursor-pointer list-none items-center gap-1 rounded-full px-2.5 text-[12px] ring-1 ring-border-subtle select-none hover:ring-border-strong [&::-webkit-details-marker]:hidden">
          {t("actions.priority")} <ChevronDown className="size-3" aria-hidden />
        </summary>
        <div className="animate-overlay absolute top-9 start-0 z-40 flex w-36 flex-col gap-0.5 rounded-[16px] bg-surface-elevated p-1.5 shadow-overlay ring-1 ring-border-subtle">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                priorityRef.current?.removeAttribute("open");
                run(() => bulkSetPriorityAction({ taskIds: selectedIds, priority: p }));
              }}
              className="rounded-[10px] px-2 py-1.5 text-start text-[12.5px] hover:bg-surface-secondary"
            >
              {t(`priority.${p}`)}
            </button>
          ))}
        </div>
      </details>

      <details ref={dueRef} className="relative">
        <summary className="flex h-7 cursor-pointer list-none items-center gap-1 rounded-full px-2.5 text-[12px] ring-1 ring-border-subtle select-none hover:ring-border-strong [&::-webkit-details-marker]:hidden">
          {t("actions.dueDate")} <ChevronDown className="size-3" aria-hidden />
        </summary>
        <div className="animate-overlay absolute top-9 start-0 z-40 flex w-56 flex-col gap-2 rounded-[16px] bg-surface-elevated p-2.5 shadow-overlay ring-1 ring-border-subtle">
          <input
            type="date"
            aria-label={t("actions.dueDate")}
            onChange={(e) => {
              if (!e.target.value) return;
              dueRef.current?.removeAttribute("open");
              run(() => bulkSetDueDateAction({ taskIds: selectedIds, dueOn: e.target.value, dueTime: null }));
            }}
            className="h-8 w-full rounded-[10px] bg-surface-secondary px-2 text-[12.5px] ring-1 ring-border-subtle"
          />
          <button
            type="button"
            onClick={() => {
              dueRef.current?.removeAttribute("open");
              run(() => bulkSetDueDateAction({ taskIds: selectedIds, dueOn: null, dueTime: null }));
            }}
            className="self-start text-[12px] text-foreground-muted hover:text-foreground"
          >
            {t("actions.clearDueDate")}
          </button>
        </div>
      </details>

      {labelOptions.length > 0 && (
        <details ref={labelRef} className="relative">
          <summary className="flex h-7 cursor-pointer list-none items-center gap-1 rounded-full px-2.5 text-[12px] ring-1 ring-border-subtle select-none hover:ring-border-strong [&::-webkit-details-marker]:hidden">
            <Tag className="size-3.5" aria-hidden /> {t("actions.labels")} <ChevronDown className="size-3" aria-hidden />
          </summary>
          <div className="animate-overlay absolute top-9 start-0 z-40 flex w-56 flex-col gap-2 rounded-[16px] bg-surface-elevated p-2.5 shadow-overlay ring-1 ring-border-subtle">
            <p className="text-[11px] text-foreground-muted">{t("actions.labelsHint")}</p>
            <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
              {labelOptions.map((l) => (
                <span key={l.id} className="inline-flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      labelRef.current?.removeAttribute("open");
                      run(() => bulkAddLabelsAction({ taskIds: selectedIds, labelIds: [l.id] }));
                    }}
                    aria-label={t("actions.addLabel", { name: l.name })}
                  >
                    <Chip tone={toneOf(l.color ?? "slate")}>
                      <span dir="auto">+ {l.name}</span>
                    </Chip>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      labelRef.current?.removeAttribute("open");
                      run(() => bulkRemoveLabelsAction({ taskIds: selectedIds, labelIds: [l.id] }));
                    }}
                    aria-label={t("actions.removeLabel", { name: l.name })}
                    className="text-[11px] text-foreground-subtle hover:text-foreground"
                  >
                    −
                  </button>
                </span>
              ))}
            </div>
          </div>
        </details>
      )}

      {memberOptions.length > 0 && (
        <details ref={assigneeRef} className="relative">
          <summary className="flex h-7 cursor-pointer list-none items-center gap-1 rounded-full px-2.5 text-[12px] ring-1 ring-border-subtle select-none hover:ring-border-strong [&::-webkit-details-marker]:hidden">
            <Users className="size-3.5" aria-hidden /> {t("actions.assign")} <ChevronDown className="size-3" aria-hidden />
          </summary>
          <div className="animate-overlay absolute top-9 start-0 z-40 flex max-h-48 w-48 flex-col gap-0.5 overflow-y-auto rounded-[16px] bg-surface-elevated p-1.5 shadow-overlay ring-1 ring-border-subtle">
            {memberOptions.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-1 rounded-[10px] px-2 py-1 hover:bg-surface-secondary">
                <span dir="auto" className="truncate text-[12.5px]">
                  {m.name}
                </span>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      assigneeRef.current?.removeAttribute("open");
                      run(() => bulkAddAssigneesAction({ taskIds: selectedIds, userIds: [m.id] }));
                    }}
                    aria-label={t("actions.addAssignee", { name: m.name })}
                    className="text-[12px] text-foreground-muted hover:text-foreground"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      assigneeRef.current?.removeAttribute("open");
                      run(() => bulkRemoveAssigneesAction({ taskIds: selectedIds, userIds: [m.id] }));
                    }}
                    aria-label={t("actions.removeAssignee", { name: m.name })}
                    className="text-[12px] text-foreground-muted hover:text-foreground"
                  >
                    −
                  </button>
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {projectOptions.length > 0 && (
        <details ref={projectRef} className="relative">
          <summary className="flex h-7 cursor-pointer list-none items-center gap-1 rounded-full px-2.5 text-[12px] ring-1 ring-border-subtle select-none hover:ring-border-strong [&::-webkit-details-marker]:hidden">
            {t("actions.move")} <ChevronDown className="size-3" aria-hidden />
          </summary>
          <div className="animate-overlay absolute top-9 start-0 z-40 flex max-h-48 w-48 flex-col gap-0.5 overflow-y-auto rounded-[16px] bg-surface-elevated p-1.5 shadow-overlay ring-1 ring-border-subtle">
            <button
              type="button"
              onClick={() => {
                projectRef.current?.removeAttribute("open");
                run(() => bulkMoveToProjectAction({ taskIds: selectedIds, projectId: null }));
              }}
              className="rounded-[10px] px-2 py-1.5 text-start text-[12.5px] text-foreground-muted hover:bg-surface-secondary"
            >
              {t("actions.moveToNone")}
            </button>
            {projectOptions.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  projectRef.current?.removeAttribute("open");
                  run(() => bulkMoveToProjectAction({ taskIds: selectedIds, projectId: p.id }));
                }}
                className="truncate rounded-[10px] px-2 py-1.5 text-start text-[12.5px] hover:bg-surface-secondary"
              >
                <span dir="auto">{p.name}</span>
              </button>
            ))}
          </div>
        </details>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirmDelete(true)}
        className="flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] text-accent-red ring-1 ring-border-subtle hover:ring-accent-red"
      >
        <Trash2 className="size-3.5" aria-hidden /> {t("actions.delete")}
      </button>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("confirmDelete.title", { count: selectedIds.length })}
        reason={t("confirmDelete.reason")}
        confirmLabel={t("actions.delete")}
        onConfirm={async () => {
          setConfirmDelete(false);
          run(() => bulkDeleteAction({ taskIds: selectedIds }));
        }}
      />

      {error && (
        <span className="text-[12px] text-accent-red" role="status">
          {error}
        </span>
      )}
    </div>
  );
}
