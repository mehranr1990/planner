"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { signInAction, signUpAction, type AuthFormState } from "../server/actions";

const noopSubscribe = () => () => {};
const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function AuthForm({ mode, next }: { mode: "sign-in" | "sign-up"; next: string | null }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthFormState, FormData>(mode === "sign-in" ? signInAction : signUpAction, {});
  // The browser's timezone seeds the account preference; the server validates it.
  // Rendered as a value (not set imperatively) so React's post-action form reset can't clear it.
  const timezone = useSyncExternalStore(noopSubscribe, browserTimezone, () => "UTC");
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {mode === "sign-up" && (
        <>
          <input type="hidden" name="timezone" value={timezone} />
          <Field label={t("fields.name")} htmlFor="name" error={fe.name}>
            <Input id="name" name="name" dir="auto" autoComplete="name" defaultValue={state.name} required aria-invalid={!!fe.name} aria-describedby={fe.name ? "name-error" : undefined} />
          </Field>
        </>
      )}
      <Field label={t("fields.email")} htmlFor="email" error={fe.email}>
        <Input id="email" name="email" type="email" dir="ltr" autoComplete="email" defaultValue={state.email} required aria-invalid={!!fe.email} aria-describedby={fe.email ? "email-error" : undefined} />
      </Field>
      <Field label={t("fields.password")} htmlFor="password" error={fe.password} hint={mode === "sign-up" ? t("fields.passwordHint") : undefined}>
        <Input
          id="password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          required
          aria-invalid={!!fe.password}
          aria-describedby={fe.password ? "password-error" : undefined}
        />
      </Field>
      {state.error && (
        <p role="alert" className="rounded-[14px] bg-accent-red-soft/40 px-4 py-3 text-[13px]">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" disabled={pending} className="mt-2">
        {pending ? t("pending") : mode === "sign-in" ? t("signIn.submit") : t("signUp.submit")}
      </Button>
      <p className="text-center text-[13px] text-foreground-muted">
        {mode === "sign-in" ? (
          <>
            {t("signIn.newHere")}{" "}
            <Link href={next ? `/sign-up?next=${encodeURIComponent(next)}` : "/sign-up"} className="font-medium text-foreground underline-offset-4 hover:underline">
              {t("signIn.createAccount")}
            </Link>
          </>
        ) : (
          <>
            {t("signUp.haveAccount")}{" "}
            <Link href={next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in"} className="font-medium text-foreground underline-offset-4 hover:underline">
              {t("signUp.signIn")}
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
