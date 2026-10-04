"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { changePasswordAction } from "../server/actions";

export function ChangePasswordForm() {
  const t = useTranslations("security.password");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      action={(form) =>
        start(async () => {
          setMessage(null);
          const res = await changePasswordAction({
            currentPassword: String(form.get("currentPassword")),
            newPassword: String(form.get("newPassword")),
          });
          setMessage(res.ok ? { ok: true, text: t("changed") } : { ok: false, text: res.error });
          if (res.ok) (document.getElementById("change-password-form") as HTMLFormElement | null)?.reset();
        })
      }
      id="change-password-form"
      className="flex flex-col gap-4"
    >
      <Field label={t("current")} htmlFor="current-password">
        <Input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required />
      </Field>
      <Field label={t("next")} htmlFor="new-password" hint={t("nextHint")}>
        <Input id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength={10} required />
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
