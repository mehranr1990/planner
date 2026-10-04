"use client";

import {
  AlertTriangle,
  Archive,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Forward,
  Inbox,
  LayoutList,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconLink } from "@/components/ui/button";
import { PLANNER_VIEWS, type PlannerView } from "@/features/tasks/domain/planner-views";

const PLANNER_VIEW_ICONS: Record<PlannerView, LucideIcon> = {
  inbox: Inbox,
  today: CalendarCheck,
  upcoming: CalendarClock,
  overdue: AlertTriangle,
  scheduled: CalendarDays,
  someday: Archive,
  completed: CheckCircle2,
  all: LayoutList,
  delegated: Forward,
};

/**
 * Contextual sub-navigation for the active top-level module (top header = primary modules, this
 * rail = that module's own views/pages). Only Planner has sub-views today; other sections render
 * nothing here until they do — no invented sub-nav for modules that don't have one yet.
 */
export function SubNav() {
  const pathname = usePathname();
  const t = useTranslations("planner");

  if (!pathname.startsWith("/planner")) return null;

  return (
    <nav
      aria-label={t("viewsSidebarNav")}
      className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-[76px] shrink-0 flex-col items-center gap-2 overflow-y-auto py-5 lg:flex"
    >
      <ul className="flex flex-col items-center gap-2">
        {PLANNER_VIEWS.map((view) => {
          const Icon = PLANNER_VIEW_ICONS[view];
          const active = pathname === `/planner/${view}`;
          return (
            <li key={view}>
              <IconLink href={`/planner/${view}`} label={t(`views.${view}.label`)} active={active}>
                <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
              </IconLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
