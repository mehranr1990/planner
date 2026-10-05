"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import type { PersonRef } from "@/components/ui/people";
import { LOCALE_NAMES, LOCALES, type AppLocale } from "@/i18n/config";
import { createWorkspaceAction } from "@/features/workspace/server/actions";
import { removeAvatarAction, updatePreferencesAction, uploadAvatarAction } from "../server/actions";

function useAction() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) =>
    start(async () => {
      setMessage(null);
      const res = await fn();
      setMessage(res.ok ? { ok: true, text: success } : { ok: false, text: res.error ?? "" });
      if (res.ok) after?.();
    });
  return { pending, message, run };
}

function Status({ message }: { message: { ok: boolean; text: string } | null }) {
  if (!message) return null;
  return (
    <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-[12.5px] text-foreground-muted" : "text-[12.5px] text-accent-red"}>
      {message.text}
    </p>
  );
}

const WEEK_STARTS = ["1", "0", "6"] as const;
const THEMES = ["SYSTEM", "LIGHT", "DARK"] as const;

export function ProfileForm({ name }: { name: string }) {
  const t = useTranslations("settings.profile");
  const { pending, message, run } = useAction();
  return (
    <form
      action={(form) => run(() => updatePreferencesAction({ name: String(form.get("name")) }), t("saved"))}
      className="flex flex-col gap-4"
    >
      <Field label={t("name")} htmlFor="profile-name">
        <Input id="profile-name" name="name" dir="auto" defaultValue={name} required maxLength={80} />
      </Field>
      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" variant="primary" disabled={pending}>
          {t("save")}
        </Button>
        <Status message={message} />
      </div>
    </form>
  );
}

/** Compact avatar upload/replace/remove (Batch 6) — its own small form, not folded into
 * `ProfileForm`'s single-field `useAction` shape, since it needs FormData + optimistic preview. */
export function AvatarForm({ user }: { user: PersonRef }) {
  const t = useTranslations("settings.profile");
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setError(null);
    const form = new FormData();
    form.set("file", file);
    start(async () => {
      const res = await uploadAvatarAction(form);
      if (res.ok) {
        setAvatarUrl(res.data.avatarUrl);
        router.refresh();
      } else setError(res.error ?? null);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function handleRemove() {
    setError(null);
    start(async () => {
      const res = await removeAvatarAction();
      if (res.ok) {
        setAvatarUrl(null);
        router.refresh();
      } else setError(res.error ?? null);
    });
  }

  return (
    <div className="mb-5 flex items-center gap-4">
      <Avatar person={{ ...user, avatarUrl }} size="lg" />
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <label className="inline-flex h-8 cursor-pointer items-center rounded-full bg-surface-elevated px-3.5 text-[13px] ring-1 ring-border-subtle hover:ring-border-strong">
            {pending ? t("avatarUploading") : t("avatarUpload")}
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" disabled={pending} onChange={(e) => handleFiles(e.target.files)} />
          </label>
          {avatarUrl && (
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={handleRemove}>
              {t("avatarRemove")}
            </Button>
          )}
        </div>
        {error && (
          <span role="alert" className="text-[12.5px] text-accent-red">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

export function AppearanceForm({ theme }: { theme: "SYSTEM" | "LIGHT" | "DARK" }) {
  const t = useTranslations("settings.appearance");
  const { pending, message, run } = useAction();
  return (
    <form
      action={(form) => run(() => updatePreferencesAction({ theme: String(form.get("theme")) as (typeof THEMES)[number] }), t("saved"))}
      className="flex flex-col gap-4"
    >
      <Field label={t("theme")} htmlFor="appearance-theme">
        <Select id="appearance-theme" name="theme" defaultValue={theme}>
          {THEMES.map((th) => (
            <option key={th} value={th}>
              {t(`themes.${th}`)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" variant="primary" disabled={pending}>
          {t("save")}
        </Button>
        <Status message={message} />
      </div>
    </form>
  );
}

export function PreferencesForm({ timezone, weekStartsOn, timezones }: { timezone: string; weekStartsOn: number; timezones: string[] }) {
  const t = useTranslations("settings.prefs");
  const { pending, message, run } = useAction();
  return (
    <form
      action={(form) =>
        run(
          () => updatePreferencesAction({ timezone: String(form.get("timezone")), weekStartsOn: Number(form.get("weekStartsOn")) }),
          t("saved"),
        )
      }
      className="flex flex-col gap-4"
    >
      <Field label={t("timezone")} htmlFor="pref-tz" hint={t("timezoneHint")}>
        <Select id="pref-tz" name="timezone" defaultValue={timezone} dir="ltr">
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("weekStart")} htmlFor="pref-week">
        <Select id="pref-week" name="weekStartsOn" defaultValue={String(weekStartsOn)}>
          {WEEK_STARTS.map((d) => (
            <option key={d} value={d}>
              {t(`weekdays.${d}`)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" variant="primary" disabled={pending}>
          {t("save")}
        </Button>
        <Status message={message} />
      </div>
    </form>
  );
}

export function LanguageForm({ locale }: { locale: AppLocale }) {
  const t = useTranslations("settings.account");
  const router = useRouter();
  const { pending, message, run } = useAction();
  return (
    <form
      action={(form) => {
        const nextLocale = String(form.get("locale")) as AppLocale;
        run(() => updatePreferencesAction({ locale: nextLocale }), t("languageSaved"), () => nextLocale !== locale && router.refresh());
      }}
      className="flex flex-col gap-4"
    >
      <Field label={t("language")} htmlFor="account-locale" hint={t("languageHint")}>
        <Select id="account-locale" name="locale" defaultValue={locale}>
          {LOCALES.map((l) => (
            <option key={l} value={l} lang={l}>
              {LOCALE_NAMES[l]}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" variant="primary" disabled={pending}>
          {t("save")}
        </Button>
        <Status message={message} />
      </div>
    </form>
  );
}

export function CreateWorkspaceForm({ timezone }: { timezone: string }) {
  const t = useTranslations("settings.workspaces");
  const router = useRouter();
  const { pending, message, run } = useAction();
  const [name, setName] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createWorkspaceAction({ name, timezone }), t("created"), () => {
          setName("");
          router.refresh();
        });
      }}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <Field label={t("name")} htmlFor="ws-name" className="flex-1">
        <Input id="ws-name" dir="auto" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} placeholder={t("placeholder")} />
      </Field>
      <Button type="submit" variant="primary" disabled={pending || name.trim().length < 2}>
        {t("create")}
      </Button>
      <Status message={message} />
    </form>
  );
}

export { Status, useAction };
