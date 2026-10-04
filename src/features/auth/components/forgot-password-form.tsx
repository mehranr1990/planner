"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { requestPasswordResetAction } from "../server/actions";

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgotPassword");
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return <p className="text-[14px] leading-6 text-foreground-muted">{t("sent")}</p>;
  }

  return (
    <form
      action={(form) =>
        start(async () => {
          setError(null);
          const res = await requestPasswordResetAction({ email: String(form.get("email")) });
          // Format errors are shown; a nonexistent account still reports success (generic response).
          if (!res.ok) return setError(res.error);
          setSent(true);
        })
      }
      className="flex flex-col gap-4"
    >
      <Field label={t("email")} htmlFor="forgot-email" error={error ?? undefined}>
        <Input id="forgot-email" name="email" type="email" dir="ltr" autoComplete="email" required />
      </Field>
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {t("submit")}
      </Button>
      <p className="text-center text-[13px] text-foreground-muted">
        <Link href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">
          {t("backToSignIn")}
        </Link>
      </p>
    </form>
  );
}
