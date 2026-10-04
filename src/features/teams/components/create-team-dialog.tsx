"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { createTeamAction } from "../server/actions";

export function CreateTeamDialog({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("workspace.teams");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        {t("create")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("createTitle")}>
        <form
          className="flex flex-col gap-4"
          action={(form) =>
            start(async () => {
              setError(null);
              const res = await createTeamAction({ workspaceId, name: String(form.get("name")), description: String(form.get("description") || "") || undefined });
              if (!res.ok) return setError(res.error);
              setOpen(false);
              router.refresh();
            })
          }
        >
          <Field label={t("name")} htmlFor="team-name">
            <Input id="team-name" name="name" dir="auto" required minLength={2} maxLength={80} />
          </Field>
          <Field label={t("description")} htmlFor="team-description">
            <Textarea id="team-description" name="description" dir="auto" maxLength={500} />
          </Field>
          {error && (
            <p role="alert" className="text-[12.5px] text-accent-red">
              {error}
            </p>
          )}
          <DialogFooter cancelLabel={t("cancel")} submitLabel={t("create")} onCancel={() => setOpen(false)} pending={pending} />
        </form>
      </Dialog>
    </>
  );
}
