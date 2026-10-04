"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { isActive, PRIMARY_NAV } from "./nav";

/**
 * Desktop top-bar nav: plain text items, the active one in a black pill (reference: top bar
 * "Relationship · Opportunities · … · Cases" with "Cases" as the filled pill). Mobile keeps its
 * own bottom tab bar instead — see MobileTabBar.
 */
export function PrimaryNav() {
  const pathname = usePathname();
  const t = useTranslations("navigation");
  return (
    <nav aria-label={t("main")} className="hidden lg:flex">
      <ul className="flex items-center gap-1">
        {PRIMARY_NAV.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full px-4 text-[14px] font-medium whitespace-nowrap transition-colors duration-150",
                  active ? "bg-surface-active text-foreground-on-active" : "text-foreground-muted hover:text-foreground",
                )}
              >
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
