"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { LOCALE_NAMES, LOCALES, type AppLocale } from "@/i18n/config";
import { createWorkspaceAction } from "@/features/workspace/server/actions";
import { updatePreferencesAction } from "../server/actions";

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

export function PreferencesForm({
  name,
  timezone,
  weekStartsOn,
  theme,
  locale,
  timezones,
}: {
  name: string;
  timezone: string;
  weekStartsOn: number;
  theme: "SYSTEM" | "LIGHT" | "DARK";
  locale: AppLocale;
  timezones: string[];
}) {
  const t = useTranslations("settings.prefs");
  const router = useRouter();
  const { pending, message, run } = useAction();
  return (
    <form
      action={(form) => {
        const nextLocale = String(form.get("locale")) as AppLocale;
        run(
          () =>
            updatePreferencesAction({
              name: String(form.get("name")),
              timezone: String(form.get("timezone")),
              weekStartsOn: Number(form.get("weekStartsOn")),
              theme: String(form.get("theme")) as (typeof THEMES)[number],
              locale: nextLocale,
            }),
          t("saved"),
          // A language change re-renders the current route in place: same URL, same workspace,
          // same session. The server picks the new locale up from the account.
          () => nextLocale !== locale && router.refresh(),
        );
      }}
      // One column, labels at the start (reference form).
      className="flex flex-col gap-4"
    >
      <Field label={t("name")} htmlFor="pref-name">
        <Input id="pref-name" name="name" dir="auto" defaultValue={name} required maxLength={80} />
      </Field>
      <Field label={t("language")} htmlFor="pref-locale" hint={t("languageHint")}>
        <Select id="pref-locale" name="locale" defaultValue={locale}>
          {LOCALES.map((l) => (
            <option key={l} value={l} lang={l}>
              {LOCALE_NAMES[l]}
            </option>
          ))}
        </Select>
      </Field>
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
      <Field label={t("appearance")} htmlFor="pref-theme">
        <Select id="pref-theme" name="theme" defaultValue={theme}>
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
