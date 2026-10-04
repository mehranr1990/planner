"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";

const SECTIONS = ["profile", "account", "appearance", "notifications", "preferences", "security", "connections"] as const;

export function SettingsNav() {
  const pathname = usePathname();
  const t = useTranslations("settings.nav");
  return (
    <nav aria-label={t("label")} className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
      {SECTIONS.map((section) => {
        const href = `/settings/${section}`;
        const active = pathname === href;
        return (
          <ButtonLink key={section} href={href} variant={active ? "primary" : "secondary"} size="sm" aria-current={active ? "page" : undefined}>
            {t(section)}
          </ButtonLink>
        );
      })}
    </nav>
  );
}
