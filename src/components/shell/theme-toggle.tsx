"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { updatePreferencesAction } from "@/features/account/server/actions";
import { cn } from "@/lib/cn";

function applyTheme(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme);
}

/** Two-state stack like the reference (moon / sun). Saved to the account, not the browser. */
export function ThemeToggle({ theme }: { theme: "SYSTEM" | "LIGHT" | "DARK" }) {
  const [pending, start] = useTransition();
  const t = useTranslations("navigation.theme");
  const set = (next: "LIGHT" | "DARK") => {
    // Apply immediately; the server render that follows confirms it.
    applyTheme(next === "DARK" ? "dark" : "light");
    start(async () => {
      await updatePreferencesAction({ theme: next });
    });
  };
  const option = (value: "LIGHT" | "DARK", label: string, Icon: typeof Sun) => {
    const active = theme === value;
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        title={label}
        disabled={pending}
        onClick={() => set(value)}
        className={cn(
          "inline-flex size-10 items-center justify-center rounded-full transition-colors",
          active ? "bg-surface-active text-foreground-on-active" : "text-foreground-muted hover:text-foreground",
        )}
      >
        <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
      </button>
    );
  };
  return (
    <div role="group" aria-label={t("group")} className="flex flex-col gap-1 rounded-full p-1 ring-1 ring-border-subtle">
      {option("DARK", t("dark"), Moon)}
      {option("LIGHT", t("light"), Sun)}
    </div>
  );
}
