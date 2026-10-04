import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ButtonLink, IconLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/data-viz";
import { PeopleCluster } from "@/components/ui/people-cluster";
import { DarkCard, EmptyState, Metric, Panel, SectionHeader } from "@/components/ui/surface";
import { getFormat } from "@/i18n/get-format";
import { localMinutes } from "@/lib/time";
import { ProjectCard } from "@/features/projects/components/project-card";
import { listProjects } from "@/features/projects/server/queries";
import { QuickAdd } from "@/features/tasks/components/quick-add";
import { TaskList } from "@/features/tasks/components/task-list";
import type { PlannerScopeFilter } from "@/features/tasks/domain/planner-views";
import { creatableContexts, defaultCreateContext } from "@/features/tasks/server/contexts";
import { getPlannerCounts, getPlannerTasks } from "@/features/tasks/server/queries";
import type { TaskListItem } from "@/features/tasks/types";
import { getViewer } from "@/server/context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home");
  return { title: t("metaTitle") };
}

const PRIORITY_RANK = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 } as const;

/** The single most pressing open task: earliest timed task today, else highest priority. */
function nextUp(tasks: TaskListItem[]): TaskListItem | null {
  const timed = tasks.filter((t) => t.dueAt).sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
  if (timed[0]) return timed[0];
  return [...tasks].sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority])[0] ?? null;
}

function partOfDay(minutes: number): "morning" | "afternoon" | "evening" {
  if (minutes < 12 * 60) return "morning";
  if (minutes < 18 * 60) return "afternoon";
  return "evening";
}

export default async function HomePage() {
  const viewer = await getViewer();
  // One-time nudge to the onboarding wizard; it never blocks any other route (§87, Q-PO-3).
  if (!viewer.user.isOnboarded) redirect("/onboarding");
  const [t, tt, tc, f] = await Promise.all([getTranslations("home"), getTranslations("tasks"), getTranslations("common"), getFormat()]);
  const ws = viewer.activeWorkspace;
  // Home follows the active context: personal shows everything that is yours; a workspace narrows to it.
  const filter: PlannerScopeFilter = ws ? { kind: "workspace", workspaceId: ws.id } : { kind: "all" };
  const [{ today, tasks }, counts, projects] = await Promise.all([
    getPlannerTasks(viewer, "today", filter),
    getPlannerCounts(viewer, filter),
    listProjects(viewer, { workspaceId: ws?.id ?? null }),
  ]);
  const focus = nextUp(tasks);
  const firstName = viewer.user.name.split(" ")[0] ?? viewer.user.name;
  const tz = viewer.user.timezone;

  return (
    <>
      <div className="mb-6">
        {/* data-volatile: depends on the calendar day / time of day (masked in visual baselines). */}
        <p className="text-[13px] text-foreground-muted" data-volatile>
          {f.date(today, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="mt-1 text-[30px] leading-[40px] font-medium tracking-[-0.02em] sm:text-[32px] sm:leading-[42px]" data-volatile>
          {t(`greeting.${partOfDay(localMinutes(new Date(), tz))}`, { name: firstName })}
        </h1>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel aria-labelledby="today-heading">
          <SectionHeader
            title={<span id="today-heading">{t("today")}</span>}
            count={tasks.length}
            actions={
              <IconLink href="/planner/today" label={t("openToday")}>
                <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
              </IconLink>
            }
          />
          <div className="mb-3">
            <QuickAdd today={today} contexts={creatableContexts(viewer, tc("personal"))} defaultContext={defaultCreateContext(viewer)} view="today" placeholder={t("quickAddPlaceholder")} />
          </div>
          <TaskList view="today" tasks={tasks.slice(0, 8)} today={today} timezone={tz} showContext={!ws && viewer.workspaces.length > 0} empty={{ title: t("emptyTitle"), hint: t("emptyHint") }} />
          {tasks.length > 8 && (
            <Link href="/planner/today" className="mt-3 block px-3 text-[13px] text-foreground-muted hover:text-foreground">
              {t("moreInToday", { count: tasks.length - 8 })}
            </Link>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <DarkCard aria-labelledby="next-heading">
            <div className="flex items-start justify-between gap-3">
              <p id="next-heading" className="text-[12.5px] opacity-70">
                {t("nextUp")}
              </p>
              {focus && <PeopleCluster people={focus.assignees} total={focus.assigneeCount} size="sm" max={3} on="dark" label={tt("row.assignees")} />}
            </div>
            {focus ? (
              <>
                <p className="mt-2 text-[19px] leading-7 font-medium tracking-[-0.01em]" dir="auto">
                  {focus.title}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {focus.dueAt && <Chip tone="blue">{f.time(new Date(focus.dueAt), tz)}</Chip>}
                  {focus.priority !== "NONE" && <Chip tone={focus.priority === "URGENT" || focus.priority === "HIGH" ? "red" : "yellow"}>{tt(`priority.${focus.priority}`)}</Chip>}
                  {focus.project && (
                    <Chip tone="slate">
                      <span dir="auto">{focus.project.name}</span>
                    </Chip>
                  )}
                </div>
                <ButtonLink href={`/planner/today?task=${focus.id}`} variant="secondary" className="mt-5">
                  {t("openTask")}
                </ButtonLink>
              </>
            ) : (
              <p className="mt-2 text-[15px] opacity-80">{t("nothingPressing")}</p>
            )}
          </DarkCard>
          <Panel>
            <div className="grid grid-cols-3 gap-4">
              <Link href="/planner/today" className="rounded-[16px]">
                <Metric value={f.number(counts.today)} label={t("metrics.today")} />
              </Link>
              <Link href="/planner/overdue" className="rounded-[16px]">
                <Metric value={f.number(counts.overdue)} label={t("metrics.overdue")} />
              </Link>
              <Link href="/planner/inbox" className="rounded-[16px]">
                <Metric value={f.number(counts.inbox)} label={t("metrics.inbox")} />
              </Link>
            </div>
          </Panel>
        </div>
      </div>

      <Panel aria-labelledby="projects-heading" className="mt-4">
        <SectionHeader
          title={<span id="projects-heading">{ws ? t("projectsWorkspace", { workspace: ws.name }) : t("projectsPersonal")}</span>}
          count={projects.length}
          actions={
            <IconLink href="/projects" label={t("allProjects")}>
              <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
            </IconLink>
          }
        />
        {projects.length === 0 ? (
          <EmptyState
            title={t("emptyProjectsTitle")}
            hint={t("emptyProjectsHint")}
            action={
              <ButtonLink href="/projects" variant="primary">
                {t("createProject")}
              </ButtonLink>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.slice(0, 3).map((p, i) => (
              <ProjectCard key={p.id} project={p} index={i} />
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
