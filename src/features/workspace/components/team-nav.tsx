"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";

const SECTIONS = [
  { key: "members", href: "/team" },
  { key: "invitations", href: "/team/invitations" },
  { key: "teams", href: "/team/teams" },
  { key: "guests", href: "/team/guests" },
] as const;

export function TeamNav() {
  const pathname = usePathname();
  const t = useTranslations("workspace.nav");
  return (
    <nav aria-label={t("label")} className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
      {SECTIONS.map((s) => {
        const active = s.href === "/team" ? pathname === "/team" : pathname.startsWith(s.href);
        return (
          <ButtonLink key={s.href} href={s.href} variant={active ? "primary" : "secondary"} size="sm" aria-current={active ? "page" : undefined}>
            {t(s.key)}
          </ButtonLink>
        );
      })}
    </nav>
  );
}
