"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getLocale, getTranslations } from "next-intl/server";
import { LOCALE_COOKIE } from "@/i18n/config";
import type { ErrorCode } from "@/i18n/messages";
import type { ActionResult } from "@/lib/action-result";
import { createSession, destroySession } from "@/server/auth/session";
import { DomainError } from "@/server/errors";
import { invalidInput, runAction } from "@/server/run-action";
import * as service from "./service";

export interface AuthFormState {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "password", string>>;
  email?: string;
  name?: string;
}

const emailSchema = z.email("emailInvalid").max(254).transform((v) => v.toLowerCase());

const signUpSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(80),
  email: emailSchema,
  password: z.string().min(10, "passwordTooShort").max(200),
  timezone: z.string().optional(),
});

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "passwordRequired").max(200),
});

function safeNext(value: FormDataEntryValue | null): string {
  // Only same-origin relative paths; blocks open redirects like //evil.com or /\evil.com.
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/home";
}

/** Schema messages are error codes; translate them in the request locale. */
async function fieldErrorsOf(error: z.ZodError): Promise<AuthFormState["fieldErrors"]> {
  const t = await getTranslations("errors");
  const flat = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  const msg = (code?: string) => (code ? (t.has(code as ErrorCode) ? t(code as ErrorCode) : t("invalidInput")) : undefined);
  return { name: msg(flat.name?.[0]), email: msg(flat.email?.[0]), password: msg(flat.password?.[0]) };
}

export async function signUpAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(form));
  const echo = { email: String(form.get("email") ?? ""), name: String(form.get("name") ?? "") };
  if (!parsed.success) return { ...echo, fieldErrors: await fieldErrorsOf(parsed.error) };

  let userId: string;
  try {
    ({ userId } = await service.registerUser({ ...parsed.data, locale: await getLocale() }));
  } catch (e) {
    if (e instanceof DomainError && e.code === "emailTaken") return { ...echo, fieldErrors: { email: (await getTranslations("errors"))("emailTaken") } };
    throw e;
  }
  await createSession(userId, (await headers()).get("user-agent"));
  redirect(safeNext(form.get("next")));
}

export async function signInAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(form));
  const echo = { email: String(form.get("email") ?? "") };
  if (!parsed.success) return { ...echo, fieldErrors: await fieldErrorsOf(parsed.error) };

  let userId: string;
  try {
    ({ userId } = await service.authenticate(parsed.data));
  } catch (e) {
    if (e instanceof DomainError) return { ...echo, error: (await getTranslations("errors"))("invalidCredentials") };
    throw e;
  }

  await createSession(userId, (await headers()).get("user-agent"));
  redirect(safeNext(form.get("next")));
}

export async function signOutAction(): Promise<void> {
  // Keep the user's language for the signed-out pages on this browser.
  (await cookies()).set(LOCALE_COOKIE, await getLocale(), { path: "/", sameSite: "lax", maxAge: 365 * 86_400 });
  await destroySession();
  redirect("/sign-in");
}

const forgotPasswordSchema = z.object({ email: emailSchema });

export async function requestPasswordResetAction(raw: z.input<typeof forgotPasswordSchema>): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  return runAction("auth", () => service.requestPasswordReset(parsed.data.email));
}

const resetPasswordSchema = z.object({ token: z.string().min(1), password: z.string().min(10, "passwordTooShort").max(200) });

export async function resetPasswordAction(raw: z.input<typeof resetPasswordSchema>): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) return invalidInput(parsed.error);
  return runAction("auth", () => service.resetPassword(parsed.data.token, parsed.data.password));
}
