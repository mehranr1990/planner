"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "./button";
import { Dialog } from "./dialog";

/**
 * Destructive confirmation: title + a reason explaining the consequence, a single danger action.
 * Reused for remove-member, deactivate, revoke-invite, revoke-session, delete-role (§90 D18).
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  reason,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  reason: string;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
}) {
  const t = useTranslations("common.actions");
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="text-[14px] leading-6 text-foreground-muted">{reason}</p>
      <div className="mt-1 grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" onClick={onClose} disabled={pending}>
          {t("cancel")}
        </Button>
        <Button
          variant="danger"
          size="lg"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await onConfirm();
              onClose();
            })
          }
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
