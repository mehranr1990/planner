"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MoreHorizontal } from "lucide-react";
import { deactivateMemberAction, reactivateMemberAction, removeMemberAction } from "../server/actions";

export function MemberActions({
  workspaceId,
  userId,
  name,
  status,
  canRemove,
  canDeactivate,
}: {
  workspaceId: string;
  userId: string;
  name: string;
  status: "ACTIVE" | "DEACTIVATED";
  canRemove: boolean;
  canDeactivate: boolean;
}) {
  const t = useTranslations("workspace.memberActions");
  const router = useRouter();
  const [confirm, setConfirm] = useState<"remove" | "deactivate" | "reactivate" | null>(null);

  if (!canRemove && !canDeactivate) return null;

  return (
    <>
      <details className="group relative">
        <summary
          aria-label={t("more", { name })}
          className="inline-flex size-8 shrink-0 cursor-pointer list-none items-center justify-center rounded-full text-foreground ring-1 ring-border-subtle hover:bg-surface-elevated [&::-webkit-details-marker]:hidden"
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </summary>
        <div className="animate-overlay absolute end-0 top-10 z-40 w-48 rounded-[16px] bg-surface-elevated p-1.5 shadow-overlay ring-1 ring-border-subtle">
          {canDeactivate && status === "ACTIVE" && (
            <button type="button" onClick={() => setConfirm("deactivate")} className="flex w-full items-center rounded-[12px] px-3 py-2 text-start text-[13.5px] hover:bg-surface-secondary">
              {t("deactivate")}
            </button>
          )}
          {canDeactivate && status === "DEACTIVATED" && (
            <button type="button" onClick={() => setConfirm("reactivate")} className="flex w-full items-center rounded-[12px] px-3 py-2 text-start text-[13.5px] hover:bg-surface-secondary">
              {t("reactivate")}
            </button>
          )}
          {canRemove && (
            <button type="button" onClick={() => setConfirm("remove")} className="flex w-full items-center rounded-[12px] px-3 py-2 text-start text-[13.5px] text-accent-red hover:bg-accent-red-soft/40">
              {t("remove")}
            </button>
          )}
        </div>
      </details>

      <ConfirmDialog
        open={confirm === "remove"}
        onClose={() => setConfirm(null)}
        title={t("removeTitle", { name })}
        reason={t("removeReason")}
        confirmLabel={t("remove")}
        onConfirm={async () => {
          await removeMemberAction({ workspaceId, userId });
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={confirm === "deactivate"}
        onClose={() => setConfirm(null)}
        title={t("deactivateTitle", { name })}
        reason={t("deactivateReason")}
        confirmLabel={t("deactivate")}
        onConfirm={async () => {
          await deactivateMemberAction({ workspaceId, userId });
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={confirm === "reactivate"}
        onClose={() => setConfirm(null)}
        title={t("reactivateTitle", { name })}
        reason={t("reactivateReason")}
        confirmLabel={t("reactivate")}
        onConfirm={async () => {
          await reactivateMemberAction({ workspaceId, userId });
          router.refresh();
        }}
      />
    </>
  );
}
