"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { updateWorkspaceSettingsAction } from "../server/actions";

export function WorkspaceSettingsForm({ workspaceId, name, iconUrl, timezone }: { workspaceId: string; name: string; iconUrl: string | null; timezone: string }) {
  const t = useTranslations("workspace.general");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      action={(form) =>
        start(async () => {
          setMessage(null);
          const res = await updateWorkspaceSettingsAction({
            workspaceId,
            name: String(form.get("name")),
            iconUrl: String(form.get("iconUrl") || "") || null,
            timezone: String(form.get("timezone")),
          });
          setMessage(res.ok ? { ok: true, text: t("saved") } : { ok: false, text: res.error });
        })
      }
      className="flex flex-col gap-4"
    >
      <Field label={t("name")} htmlFor="ws-settings-name">
        <Input id="ws-settings-name" name="name" dir="auto" defaultValue={name} required minLength={2} maxLength={80} />
      </Field>
      <Field label={t("icon")} htmlFor="ws-settings-icon" hint={t("iconHint")}>
        <Input id="ws-settings-icon" name="iconUrl" type="url" dir="ltr" defaultValue={iconUrl ?? ""} placeholder="https://…" />
      </Field>
      <Field label={t("timezone")} htmlFor="ws-settings-tz">
        <Input id="ws-settings-tz" name="timezone" dir="ltr" defaultValue={timezone} required />
      </Field>
      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" variant="primary" disabled={pending}>
          {t("save")}
        </Button>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-[12.5px] text-foreground-muted" : "text-[12.5px] text-accent-red"}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
