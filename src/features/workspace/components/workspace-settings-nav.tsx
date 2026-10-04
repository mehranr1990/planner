"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";

const SECTIONS = ["general", "roles", "audit"] as const;

export function WorkspaceSettingsNav() {
  const pathname = usePathname();
  const t = useTranslations("workspace.settingsNav");
  return (
    <nav aria-label={t("label")} className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
      {SECTIONS.map((section) => {
        const href = `/settings/workspace/${section}`;
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
