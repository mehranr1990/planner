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
    <nav aria-label={t("label")} className="scrollbar-none -mx-1 mb-5 overflow-x-auto px-1 pb-1">
      <ul className="flex w-max items-center justify-center gap-2 sm:w-full">
        {SECTIONS.map((s) => {
          const active = s.href === "/team" ? pathname === "/team" : pathname.startsWith(s.href);
          return (
            <li key={s.href}>
              <ButtonLink href={s.href} variant={active ? "primary" : "secondary"} size="sm" aria-current={active ? "page" : undefined}>
                {t(s.key)}
              </ButtonLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
