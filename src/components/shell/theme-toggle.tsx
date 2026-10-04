"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { IconButton } from "@/components/ui/button";
import { updatePreferencesAction } from "@/features/account/server/actions";

function applyTheme(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme);
}

/** One compact circular action, like the reference's top-bar icon buttons: click flips light ⇄ dark. */
export function ThemeToggle({ theme }: { theme: "SYSTEM" | "LIGHT" | "DARK" }) {
  const [pending, start] = useTransition();
  const t = useTranslations("navigation.theme");
  const isDark = theme === "DARK";
  const next = isDark ? "LIGHT" : "DARK";
  const label = isDark ? t("light") : t("dark");

  return (
    <IconButton
      label={label}
      disabled={pending}
      onClick={() => {
        applyTheme(next === "DARK" ? "dark" : "light");
        start(async () => {
          await updatePreferencesAction({ theme: next });
        });
      }}
    >
      {isDark ? <Sun className="size-[18px]" strokeWidth={1.75} aria-hidden /> : <Moon className="size-[18px]" strokeWidth={1.75} aria-hidden />}
    </IconButton>
  );
}
