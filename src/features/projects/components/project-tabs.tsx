import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { IconLink } from "@/components/ui/button";
import { PeopleCluster } from "@/components/ui/people-cluster";
import { cn } from "@/lib/cn";
import type { PersonRef } from "@/components/ui/people";

const TAB_KEYS = ["tasks", "board", "timeline", "milestones"] as const;
export type ProjectTabKey = (typeof TAB_KEYS)[number];

function tabHref(projectId: string, key: ProjectTabKey) {
  return key === "tasks" ? `/projects/${projectId}` : `/projects/${projectId}/${key}`;
}

/**
 * Shared header for the Board/Timeline/Milestones tabs (Batch 5) — the pre-existing Tasks tab
 * (`/projects/[projectId]/page.tsx`) keeps its own inline header (unchanged, to avoid touching
 * already-tested markup) but renders the same `<ProjectTabs>` pill row so all four tabs agree on
 * the same navigation. Server component: `active` is supplied by the page itself (the route that
 * rendered it), so no client-side pathname matching is needed.
 */
export async function ProjectHeader({
  project,
  active,
  extra,
}: {
  project: { id: string; name: string; members: readonly PersonRef[]; memberCount: number };
  active: ProjectTabKey;
  extra?: React.ReactNode;
}) {
  const t = await getTranslations("projects");
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <IconLink href="/projects" label={t("detail.back")}>
          <ChevronLeft className="size-[18px] rtl:rotate-180" aria-hidden />
        </IconLink>
        <h1 className="min-w-0 flex-1 truncate text-[30px] leading-[40px] font-medium tracking-[-0.02em] sm:text-[32px] sm:leading-[42px]" dir="auto">
          {project.name}
        </h1>
        <PeopleCluster people={project.members} total={project.memberCount} max={6} size="sm" variant="strip" label={t("detail.membersStrip")} className="order-last sm:order-none" />
        {extra}
      </div>
      <ProjectTabs projectId={project.id} active={active} />
    </div>
  );
}

export async function ProjectTabs({ projectId, active }: { projectId: string; active: ProjectTabKey }) {
  const t = await getTranslations("projects.tabs");
  return (
    <nav aria-label={t("nav")} className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
      <ul className="flex w-max items-center justify-center gap-1.5 sm:w-full">
        {TAB_KEYS.map((key) => (
          <li key={key}>
            <Link
              href={tabHref(projectId, key)}
              scroll={false}
              aria-current={active === key ? "page" : undefined}
              className={cn(
                "flex h-9 items-center rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap ring-1 transition-colors",
                active === key
                  ? "bg-surface-active text-foreground-on-active ring-surface-active"
                  : "bg-surface-elevated text-foreground-muted ring-border-subtle hover:text-foreground hover:ring-border-strong",
              )}
            >
              {t(key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
