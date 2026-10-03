import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { IconLink } from "@/components/ui/button";
import { Chip, RingGauge, SegmentedBar, toneOf } from "@/components/ui/data-viz";
import { PeopleCluster } from "@/components/ui/people-cluster";
import { Card, Metric, Panel, SectionHeader } from "@/components/ui/surface";
import { getFormat } from "@/i18n/get-format";
import { todayIn } from "@/lib/time";
import { HEALTH_TONE } from "@/features/projects/components/project-card";
import { ProjectControls } from "@/features/projects/components/project-controls";
import { getProject, listProjectOptions } from "@/features/projects/server/queries";
import { QuickAdd } from "@/features/tasks/components/quick-add";
import { TaskList } from "@/features/tasks/components/task-list";
import { TaskSheet } from "@/features/tasks/components/task-sheet";
import { UndoDeleteBanner } from "@/features/tasks/components/undo-delete-banner";
import { getProjectTasks, getTaskDetail } from "@/features/tasks/server/queries";
import { getViewer } from "@/server/context";

export async function generateMetadata({ params }: PageProps<"/projects/[projectId]">): Promise<Metadata> {
  const { projectId } = await params;
  const viewer = await getViewer();
  const project = await getProject(viewer, projectId);
  const t = await getTranslations("projects");
  return { title: project?.name ?? t("title") };
}

export default async function ProjectPage({ params, searchParams }: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  const sp = await searchParams;
  const viewer = await getViewer();
  const project = await getProject(viewer, projectId);
  if (!project) notFound();
  const [t, tt, tc, f] = await Promise.all([getTranslations("projects"), getTranslations("tasks"), getTranslations("common"), getFormat()]);

  const showDone = sp.done === "1";
  const taskId = typeof sp.task === "string" ? sp.task : null;
  const deletedId = typeof sp.deleted === "string" ? sp.deleted : null;
  const [tasks, detail, projects] = await Promise.all([
    getProjectTasks(viewer, project.id, showDone),
    taskId ? getTaskDetail(viewer, taskId) : null,
    taskId ? listProjectOptions(viewer) : [],
  ]);
  const today = todayIn(viewer.user.timezone);
  const total = project.openTasks + project.doneTasks;
  const fraction = total ? project.doneTasks / total : 0;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3 sm:mb-6">
        <IconLink href="/projects" label={t("detail.back")}>
          {/* "Back" points toward the start edge, so it flips in RTL. */}
          <ChevronLeft className="size-[18px] rtl:rotate-180" aria-hidden />
        </IconLink>
        <h1 className="min-w-0 flex-1 truncate text-[30px] leading-[40px] font-medium tracking-[-0.02em] sm:text-[32px] sm:leading-[42px]" dir="auto">
          {project.name}
        </h1>
        {/* Detail headers carry the people strip (reference: desktop header avatar row). */}
        <PeopleCluster people={project.members} total={project.memberCount} max={6} size="sm" variant="strip" label={t("detail.membersStrip")} className="order-last sm:order-none" />
        {project.canEdit && <ProjectControls projectId={project.id} status={project.status} health={project.health} archived={project.archived} />}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel aria-labelledby="project-tasks-heading">
          <SectionHeader
            title={<span id="project-tasks-heading">{t("detail.tasks")}</span>}
            count={project.openTasks}
            actions={
              <Link href={showDone ? `/projects/${project.id}` : `/projects/${project.id}?done=1`} className="h-8 rounded-full px-3 text-[12.5px] leading-8 whitespace-nowrap ring-1 ring-border-subtle hover:bg-surface-elevated">
                {showDone ? t("detail.hideCompleted") : t("detail.showCompleted")}
              </Link>
            }
          />
          {project.canAddTasks && (
            <div className="mb-3">
              <QuickAdd today={today} contexts={[]} defaultContext={project.workspaceId ?? "personal"} projectId={project.id} placeholder={tt("quickAdd.placeholderProject", { project: project.name })} />
            </div>
          )}
          <TaskList
            view="project"
            tasks={tasks}
            today={today}
            timezone={viewer.user.timezone}
            showContext={false}
            empty={{ title: t("detail.emptyTitle"), hint: project.canAddTasks ? t("detail.emptyHintCanAdd") : t("detail.emptyHint") }}
          />
        </Panel>

        <aside aria-label={t("detail.overview")} className="flex flex-col gap-4">
          <Card>
            <div className="mb-4 flex flex-wrap gap-2">
              <Chip tone="slate">{project.context.kind === "workspace" ? <span dir="auto">{project.context.name}</span> : tc("personal")}</Chip>
              <Chip tone={toneOf(project.color)}>{t(`status.${project.status}`)}</Chip>
              <Chip tone={HEALTH_TONE[project.health]}>{t(`health.${project.health}`)}</Chip>
              {project.archived && <Chip tone="red">{t("detail.archived")}</Chip>}
            </div>
            {project.description && (
              <p className="mb-5 text-[13px] leading-6 whitespace-pre-line text-foreground-muted" dir="auto">
                {project.description}
              </p>
            )}
            <div className="flex items-center gap-5">
              <RingGauge value={project.doneTasks} max={total} tone={toneOf(project.color)} size={84} ariaLabel={t("detail.completionAria", { percent: fraction })}>
                <span className="tabular text-[18px] leading-5">{f.percent(fraction)}</span>
                <span className="text-[10px] text-foreground-muted">{t("card.done")}</span>
              </RingGauge>
              <div className="grid flex-1 grid-cols-2 gap-4">
                <Metric value={f.number(project.openTasks)} label={t("detail.open")} />
                <Metric value={f.number(project.overdueTasks)} label={t("detail.overdue")} />
              </div>
            </div>
            <SegmentedBar
              className="mt-5"
              ariaLabel={t("card.tasksAria", { done: project.doneTasks, open: project.openTasks - project.overdueTasks, overdue: project.overdueTasks })}
              segments={[
                { value: project.doneTasks, tone: "blue", key: "done" },
                { value: project.openTasks - project.overdueTasks, tone: "yellow", key: "open" },
                { value: project.overdueTasks, tone: "red", key: "overdue" },
              ]}
            />
            {project.targetOn && <p className="mt-4 text-[12.5px] text-foreground-muted">{t("detail.target", { date: f.relativeDay(project.targetOn, today) })}</p>}
          </Card>
        </aside>
      </div>

      {detail && <TaskSheet key={detail.id} task={detail} projects={projects} timezone={viewer.user.timezone} />}
      {deletedId && <UndoDeleteBanner taskId={deletedId} />}
    </>
  );
}
