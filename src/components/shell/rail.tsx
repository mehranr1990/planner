"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconLink } from "@/components/ui/button";
import { isActive, PRIMARY_NAV, SECONDARY_NAV } from "./nav";
import { ThemeToggle } from "./theme-toggle";

export function Rail({ theme }: { theme: "SYSTEM" | "LIGHT" | "DARK" }) {
  const pathname = usePathname();
  const t = useTranslations("navigation");
  return (
    <nav aria-label={t("main")} className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col items-center gap-3 py-5 lg:flex">
      <ul className="mt-[68px] flex flex-col items-center gap-3">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <IconLink href={item.href} label={t(item.labelKey)} active={isActive(pathname, item)}>
                <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
              </IconLink>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto flex flex-col items-center gap-3">
        {SECONDARY_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <IconLink key={item.href} href={item.href} label={t(item.labelKey)} active={isActive(pathname, item)}>
              <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
            </IconLink>
          );
        })}
        <ThemeToggle theme={theme} />
      </div>
    </nav>
  );
}
