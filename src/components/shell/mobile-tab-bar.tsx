"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { isActive, PRIMARY_NAV } from "./nav";

/** Phone navigation: floating pill bar + black circular quick-add (reference: mobile FAB). */
export function MobileTabBar() {
  const pathname = usePathname();
  const t = useTranslations("navigation");
  return (
    <nav aria-label={t("main")} className="fixed inset-x-0 bottom-0 z-40 flex items-end justify-center gap-3 px-4 pb-[max(16px,env(safe-area-inset-bottom))] lg:hidden">
      <ul className="flex items-center gap-1 rounded-full bg-surface-elevated/90 p-1.5 shadow-overlay ring-1 ring-border-subtle backdrop-blur-xl">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-label={t(item.labelKey)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium transition-colors",
                  active ? "bg-surface-active text-foreground-on-active" : "text-foreground-muted",
                )}
              >
                <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
                {active && <span>{t(item.labelKey)}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        href="/planner/inbox#quick-add"
        aria-label={t("quickAdd")}
        className="inline-flex size-14 items-center justify-center rounded-full bg-surface-active text-foreground-on-active shadow-overlay"
      >
        <Plus className="size-6" strokeWidth={1.75} aria-hidden />
      </Link>
    </nav>
  );
}
