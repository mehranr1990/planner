"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button, IconButton } from "./button";

/**
 * Centred modal on <dialog> (native focus trap, Escape, inert background) — sibling of Sheet.
 * Reference layout: title at the start + round close at the end, a hairline divider, a single
 * column of fields on a soft grey surface, and a footer of two equal pills (DialogFooter).
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const t = useTranslations("common.actions");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop click
      }}
      className={cn(
        "animate-overlay m-auto max-h-[calc(100dvh-32px)] w-[min(480px,calc(100vw-32px))] overflow-y-auto rounded-[var(--radius-panel)] bg-surface-secondary p-0 text-foreground shadow-overlay",
        className,
      )}
    >
      {open && (
        <div className="flex flex-col gap-5 p-6 sm:p-7">
          <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-5">
            <h2 id={titleId} className="text-[18px] leading-7 font-medium tracking-[-0.01em]">
              {title}
            </h2>
            <IconButton label={t("close")} onClick={onClose} size="lg">
              <X className="size-[18px]" aria-hidden />
            </IconButton>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/** Two equal pills: secondary dismiss + primary submit (reference: "Cancel Processing / Take for Processing"). */
export function DialogFooter({ cancelLabel, submitLabel, onCancel, pending }: { cancelLabel: string; submitLabel: string; onCancel: () => void; pending?: boolean }) {
  return (
    <div className="mt-1 grid grid-cols-2 gap-3">
      <Button variant="secondary" size="lg" onClick={onCancel} disabled={pending}>
        {cancelLabel}
      </Button>
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {submitLabel}
      </Button>
    </div>
  );
}
