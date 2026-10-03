"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconButton } from "./button";

/**
 * Side sheet on desktop, bottom sheet on phones. Built on <dialog> for native focus trapping,
 * Escape handling and inert background.
 */
export function Sheet({ title, onClose, children, className }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useTranslations("common.actions");

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop click
      }}
      className={cn(
        "animate-sheet m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-[var(--radius-panel)] bg-surface-secondary p-0 text-foreground shadow-overlay",
        "sm:mt-0 sm:ms-auto sm:me-3 sm:h-[calc(100dvh-24px)] sm:max-h-none sm:w-[min(560px,calc(100vw-24px))] sm:translate-y-3 sm:rounded-[var(--radius-panel)]",
        className,
      )}
    >
      <div className="sticky top-0 z-10 flex justify-end bg-surface-secondary/90 p-3 backdrop-blur">
        <IconButton label={t("close")} onClick={onClose}>
          <X className="size-[18px]" aria-hidden />
        </IconButton>
      </div>
      <div className="px-5 pb-8 sm:px-7">{children}</div>
    </dialog>
  );
}
