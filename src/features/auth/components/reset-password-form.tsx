"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { resetPasswordAction } from "../server/actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth.resetPassword");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(form) =>
        start(async () => {
          setError(null);
          const res = await resetPasswordAction({ token, password: String(form.get("password")) });
          if (!res.ok) return setError(res.error);
          router.push("/sign-in");
        })
      }
      className="flex flex-col gap-4"
    >
      <Field label={t("newPassword")} htmlFor="reset-password" error={error ?? undefined} hint={t("hint")}>
        <Input id="reset-password" name="password" type="password" dir="ltr" autoComplete="new-password" minLength={10} required />
      </Field>
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
