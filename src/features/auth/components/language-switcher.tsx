"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setGuestLocaleAction } from "@/features/account/server/actions";
import { LOCALE_NAMES, LOCALES, type AppLocale } from "@/i18n/config";
import { cn } from "@/lib/cn";

/** Signed-out language choice (cookie). Signed-in users change language in Settings. */
export function LanguageSwitcher() {
  const t = useTranslations("navigation");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const choose = (next: AppLocale) => {
    if (next === locale) return;
    start(async () => {
      const res = await setGuestLocaleAction(next);
      if (res.ok) router.refresh();
    });
  };
  return (
    <div role="group" aria-label={t("language")} className={cn("flex items-center gap-1 rounded-full p-1 ring-1 ring-border-subtle", pending && "opacity-60")}>
      <Languages className="mx-1.5 size-4 text-foreground-muted" aria-hidden />
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === locale}
          disabled={pending}
          onClick={() => choose(l)}
          className={cn(
            "h-8 rounded-full px-3 text-[13px] transition-colors",
            l === locale ? "bg-surface-active text-foreground-on-active" : "text-foreground-muted hover:text-foreground",
          )}
        >
          {LOCALE_NAMES[l]}
        </button>
      ))}
    </div>
  );
}
