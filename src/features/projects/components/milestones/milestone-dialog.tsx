"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import type { CalendarDate } from "@/lib/time";
import { createMilestoneAction, updateMilestoneAction } from "@/features/milestones/server/actions";
import type { MilestoneSummary } from "@/features/milestones/types";

/** Create-or-edit dialog (Batch 5) — same form either way; `milestone` present means edit. */
export function MilestoneDialog({ projectId, milestone, open, onClose }: { projectId: string; milestone?: MilestoneSummary; open: boolean; onClose: () => void }) {
  const t = useTranslations("milestones");
  const tc = useTranslations("common");
  const uid = useId();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (form: FormData) => {
    setError(null);
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim() || null;
    const dueOn = (String(form.get("dueOn") ?? "") || null) as CalendarDate | null;
    start(async () => {
      const res = milestone
        ? await updateMilestoneAction({ milestoneId: milestone.id, title, description, dueOn })
        : await createMilestoneAction({ projectId, title, description, dueOn });
      if (!res.ok) return setError(res.error);
      onClose();
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title={milestone ? t("edit.title") : t("create.title")}>
      <form action={submit} className="flex flex-col gap-4">
        <Field label={t("create.titleLabel")} htmlFor={`${uid}-title`}>
          <Input id={`${uid}-title`} name="title" dir="auto" required maxLength={200} defaultValue={milestone?.title ?? ""} autoFocus />
        </Field>
        <Field label={t("create.description")} htmlFor={`${uid}-description`}>
          <Textarea id={`${uid}-description`} name="description" dir="auto" maxLength={2000} defaultValue={milestone?.description ?? ""} />
        </Field>
        <Field label={t("create.dueOn")} htmlFor={`${uid}-dueOn`}>
          <Input id={`${uid}-dueOn`} name="dueOn" type="date" defaultValue={milestone?.dueOn ?? ""} />
        </Field>
        {error && (
          <p role="alert" className="text-[13px] text-accent-red">
            {error}
          </p>
        )}
        <DialogFooter cancelLabel={tc("actions.cancel")} submitLabel={milestone ? t("edit.submit") : t("create.submit")} onCancel={onClose} pending={pending} />
      </form>
    </Dialog>
  );
}
