"use client";

import {
  AlertTriangle,
  Archive,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Forward,
  GanttChart,
  Inbox,
  Kanban,
  LayoutList,
  ListTodo,
  Milestone,
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

const PROJECT_TABS = ["tasks", "board", "timeline", "milestones"] as const;
type ProjectTab = (typeof PROJECT_TABS)[number];

const PROJECT_TAB_ICONS: Record<ProjectTab, LucideIcon> = {
  tasks: ListTodo,
  board: Kanban,
  timeline: GanttChart,
  milestones: Milestone,
};

function projectTabHref(projectId: string, tab: ProjectTab) {
  return tab === "tasks" ? `/projects/${projectId}` : `/projects/${projectId}/${tab}`;
}

/**
 * Contextual sub-navigation for the active top-level module (top header = primary modules, this
 * rail = that module's own views/pages) — additive to, not a replacement for, a module's own
 * in-panel navigation (Planner's pill row and `ProjectTabs` both still render too). Planner (8
 * views) and an open Project (Tasks/Board/Timeline/Milestones, Batch 5) have one; other sections
 * render nothing here until they do — no invented sub-nav for modules that don't have one yet.
 */
export function SubNav() {
  const pathname = usePathname();
  const tPlanner = useTranslations("planner");
  const tProjects = useTranslations("projects");

  if (pathname.startsWith("/planner")) {
    return (
      <nav
        aria-label={tPlanner("viewsSidebarNav")}
        className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-[76px] shrink-0 flex-col items-center gap-2 overflow-y-auto py-5 lg:flex"
      >
        <ul className="flex flex-col items-center gap-2">
          {PLANNER_VIEWS.map((view) => {
            const Icon = PLANNER_VIEW_ICONS[view];
            const active = pathname === `/planner/${view}`;
            return (
              <li key={view}>
                <IconLink href={`/planner/${view}`} label={tPlanner(`views.${view}.label`)} active={active}>
                  <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
                </IconLink>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  const projectMatch = pathname.match(/^\/projects\/([^/]+)(?:\/(board|timeline|milestones))?\/?$/);
  if (projectMatch) {
    const projectId = projectMatch[1]!;
    const activeTab = (projectMatch[2] as ProjectTab | undefined) ?? "tasks";
    return (
      <nav
        aria-label={tProjects("tabs.navSidebar")}
        className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-[76px] shrink-0 flex-col items-center gap-2 overflow-y-auto py-5 lg:flex"
      >
        <ul className="flex flex-col items-center gap-2">
          {PROJECT_TABS.map((tab) => {
            const Icon = PROJECT_TAB_ICONS[tab];
            const active = tab === activeTab;
            return (
              <li key={tab}>
                <IconLink href={projectTabHref(projectId, tab)} label={tProjects(`tabs.${tab}`)} active={active}>
                  <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
                </IconLink>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return null;
}
