"use client";

import { Check, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Chip } from "@/components/ui/data-viz";
import { EmptyState } from "@/components/ui/surface";
import { useFormat } from "@/i18n/use-format";
import { archiveMilestoneAction, setMilestoneCompletionAction } from "@/features/milestones/server/actions";
import type { MilestoneSummary } from "@/features/milestones/types";
import { MilestoneDialog } from "./milestone-dialog";

export function MilestoneList({ projectId, milestones }: { projectId: string; milestones: MilestoneSummary[] }) {
  const t = useTranslations("milestones");
  const f = useFormat();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dialogFor, setDialogFor] = useState<MilestoneSummary | "new" | null>(null);
  const [deleting, setDeleting] = useState<MilestoneSummary | null>(null);

  const toggle = (m: MilestoneSummary) =>
    start(async () => {
      await setMilestoneCompletionAction({ milestoneId: m.id, done: m.status !== "COMPLETED" });
      router.refresh();
    });

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button variant="secondary" onClick={() => setDialogFor("new")}>
          <Plus className="size-4" aria-hidden /> {t("new")}
        </Button>
      </div>
      {milestones.length === 0 ? (
        <EmptyState title={t("emptyTitle")} hint={t("emptyHint")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {milestones.map((m) => {
            const total = m.progress.total;
            const pct = total > 0 ? m.progress.done / total : 0;
            return (
              <li key={m.id} className="flex flex-col gap-2 rounded-[18px] bg-surface-elevated p-4">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={m.status === "COMPLETED"}
                    aria-label={m.status === "COMPLETED" ? t("reopen") : t("complete")}
                    disabled={!m.canEdit || pending}
                    onClick={() => toggle(m)}
                    className="mt-0.5 inline-flex size-[22px] shrink-0 items-center justify-center rounded-full ring-[1.5px] ring-border-strong data-[done=true]:bg-surface-active data-[done=true]:ring-surface-active"
                    data-done={m.status === "COMPLETED"}
                  >
                    {m.status === "COMPLETED" ? <Check className="size-3.5 text-foreground-on-active" strokeWidth={2.5} aria-hidden /> : <RotateCcw className="sr-only" aria-hidden />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p dir="auto" className={m.status === "COMPLETED" ? "text-[14.5px] text-foreground-subtle line-through" : "text-[14.5px]"}>
                      {m.title}
                    </p>
                    {m.description && (
                      <p dir="auto" className="mt-0.5 line-clamp-2 text-[12.5px] text-foreground-muted">
                        {m.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-foreground-muted">
                      {m.dueOn && <span className={m.isOverdue ? "text-accent-red" : undefined}>{f.date(m.dueOn, { month: "short", day: "numeric" })}</span>}
                      {m.isOverdue && <Chip tone="red">{t("overdue")}</Chip>}
                      {m.status === "COMPLETED" && <Chip tone="green">{t("completed")}</Chip>}
                      {total > 0 && <span className="tabular">{t("progress", { done: m.progress.done, total })}</span>}
                    </div>
                    {total > 0 && (
                      <div className="mt-2 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-surface-secondary">
                        <div className="h-full rounded-full bg-surface-active" style={{ width: `${Math.round(pct * 100)}%` }} />
                      </div>
                    )}
                    {total === 0 && <p className="mt-1 text-[12px] text-foreground-subtle">{t("noTasks")}</p>}
                  </div>
                  {m.canEdit && (
                    <div className="flex shrink-0 items-center gap-1">
                      <IconButton label={t("edit.title")} size="sm" onClick={() => setDialogFor(m)}>
                        <Pencil className="size-3.5" aria-hidden />
                      </IconButton>
                      <IconButton label={t("edit.delete")} size="sm" onClick={() => setDeleting(m)}>
                        <Trash2 className="size-3.5" aria-hidden />
                      </IconButton>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {dialogFor && (
        <MilestoneDialog
          projectId={projectId}
          milestone={dialogFor === "new" ? undefined : dialogFor}
          open
          onClose={() => setDialogFor(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          open
          onClose={() => setDeleting(null)}
          title={t("confirmDelete.title")}
          reason={t("confirmDelete.reason")}
          confirmLabel={t("edit.delete")}
          onConfirm={async () => {
            await archiveMilestoneAction({ milestoneId: deleting.id });
            setDeleting(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
