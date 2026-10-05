"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { archiveSectionAction } from "../../server/actions";

/** Per-column "…" menu (Batch 6 carry-over): rename hands off to the column's own inline edit
 * mode; archive reuses the already-existing `archiveSectionAction` (its tasks fall back to the
 * unsectioned column, never deleted — same shape `renameSection`/`archiveSection` have had since
 * Batch 5, only the UI affordance was missing). */
export function ColumnMenu({ sectionId, name, onRename }: { sectionId: string; name: string; onRename: () => void }) {
  const t = useTranslations("board");
  const router = useRouter();
  const [confirmArchive, setConfirmArchive] = useState(false);

  return (
    <>
      <details className="group relative shrink-0">
        <summary
          aria-label={t("columnMenu", { name })}
          className="inline-flex size-6 cursor-pointer list-none items-center justify-center rounded-full text-foreground-subtle hover:bg-surface-secondary [&::-webkit-details-marker]:hidden"
        >
          <MoreHorizontal className="size-3.5" aria-hidden />
        </summary>
        <div className="animate-overlay absolute end-0 top-7 z-40 w-40 rounded-[14px] bg-surface-elevated p-1.5 shadow-overlay ring-1 ring-border-subtle">
          <button type="button" onClick={onRename} className="flex w-full items-center rounded-[10px] px-3 py-1.5 text-start text-[13px] hover:bg-surface-secondary">
            {t("renameColumn")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmArchive(true)}
            className="flex w-full items-center rounded-[10px] px-3 py-1.5 text-start text-[13px] text-accent-red hover:bg-accent-red-soft/40"
          >
            {t("deleteColumn")}
          </button>
        </div>
      </details>
      <ConfirmDialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title={t("deleteColumnTitle", { name })}
        reason={t("deleteColumnReason")}
        confirmLabel={t("deleteColumn")}
        onConfirm={async () => {
          await archiveSectionAction({ sectionId });
          router.refresh();
        }}
      />
    </>
  );
}
