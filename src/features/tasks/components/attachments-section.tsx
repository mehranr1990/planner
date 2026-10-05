"use client";

import { Download, Loader2, Paperclip, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { useFormat } from "@/i18n/use-format";
import { removeAttachmentAction, uploadAttachmentAction } from "@/features/attachments/server/actions";
import type { AttachmentItem } from "@/features/attachments/types";

const ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/csv,application/json,application/zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

/** Compact attachment list + uploader for TaskSheet (Batch 6). Upload goes through FormData (a
 * browser `File` isn't representable as a plain action argument); the server validates the real
 * bytes, this component only sets a client-side `accept` hint. */
export function AttachmentsSection({
  taskId,
  attachments,
  canUpload,
  onError,
}: {
  taskId: string;
  attachments: readonly AttachmentItem[];
  canUpload: boolean;
  onError: (message: string | null) => void;
}) {
  const t = useTranslations("tasks.attachments");
  const f = useFormat();
  const [items, setItems] = useState(attachments);
  const [pending, start] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    onError(null);
    const form = new FormData();
    form.set("taskId", taskId);
    form.set("file", file);
    start(async () => {
      const res = await uploadAttachmentAction(form);
      if (!res.ok) onError(res.error ?? null);
      else setItems((prev) => [...prev, res.data]);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function handleRemove(id: string) {
    onError(null);
    const previous = items;
    setItems((prev) => prev.filter((a) => a.id !== id));
    setRemovingId(id);
    start(async () => {
      const res = await removeAttachmentAction({ attachmentId: id });
      if (!res.ok) {
        onError(res.error ?? null);
        setItems(previous);
      }
      setRemovingId(null);
    });
  }

  return (
    <section aria-labelledby="attachments-heading" className="mt-8">
      <h3 id="attachments-heading" className="mb-2 px-1 text-[12.5px] text-foreground-muted">
        {t("heading")}
      </h3>
      {items.length === 0 ? (
        <p className="px-1 text-[13px] text-foreground-subtle">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-[14px] px-3 py-2 text-[13px] hover:bg-surface-elevated">
              <Paperclip className="size-4 shrink-0 text-foreground-subtle" aria-hidden />
              <a href={`/api/attachments/${a.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline" dir="auto">
                {a.filename}
              </a>
              <span className="shrink-0 text-[12px] text-foreground-subtle">{f.fileSize(a.size)}</span>
              <a href={`/api/attachments/${a.id}`} aria-label={t("download", { name: a.filename })} className="shrink-0 text-foreground-muted hover:text-foreground">
                <Download className="size-4" aria-hidden />
              </a>
              {a.canDelete && (
                <button
                  type="button"
                  disabled={removingId === a.id}
                  onClick={() => handleRemove(a.id)}
                  aria-label={t("delete", { name: a.filename })}
                  className="shrink-0 text-foreground-muted hover:text-accent-red disabled:opacity-40"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canUpload && (
        <div className="mt-2 px-1">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-foreground-muted hover:text-foreground">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Paperclip className="size-4" aria-hidden />}
            {pending ? t("uploading") : t("upload")}
            <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" disabled={pending} onChange={(e) => handleFiles(e.target.files)} />
          </label>
        </div>
      )}
    </section>
  );
}
