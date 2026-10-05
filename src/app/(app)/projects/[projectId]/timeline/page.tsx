import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Panel } from "@/components/ui/surface";
import { addDays, isCalendarDate, todayIn, type CalendarDate } from "@/lib/time";
import { ProjectHeader } from "@/features/projects/components/project-tabs";
import { TimelineView } from "@/features/projects/components/timeline/timeline-view";
import { getProject, listProjectOptions } from "@/features/projects/server/queries";
import { getMentionCandidates, listTaskComments } from "@/features/collaboration/server/queries";
import { listLabels } from "@/features/labels/server/queries";
import { listMilestoneOptions } from "@/features/milestones/server/queries";
import { getMyReminder } from "@/features/reminders/server/queries";
import { FilterBar } from "@/features/tasks/components/filter-bar";
import { TaskSheet } from "@/features/tasks/components/task-sheet";
import { UndoDeleteBanner } from "@/features/tasks/components/undo-delete-banner";
import { parsePlannerFilters } from "@/features/tasks/server/filters";
import { getAssignableMembers, getTaskDetail, getTaskLabelOptions, getTimelineTasks } from "@/features/tasks/server/queries";
import { listMembers } from "@/features/workspace/server/queries";
import { getViewer } from "@/server/context";

const WINDOW_DAYS = 21;
const STEP_DAYS = 7;

export async function generateMetadata({ params }: PageProps<"/projects/[projectId]/timeline">): Promise<Metadata> {
  const { projectId } = await params;
  const viewer = await getViewer();
  const project = await getProject(viewer, projectId);
  const [t, tt] = await Promise.all([getTranslations("projects"), getTranslations("projects.tabs")]);
  return { title: project ? `${project.name} · ${tt("timeline")}` : t("title") };
}

export default async function TimelinePage({ params, searchParams }: PageProps<"/projects/[projectId]/timeline">) {
  const { projectId } = await params;
  const sp = await searchParams;
  const viewer = await getViewer();
  const project = await getProject(viewer, projectId);
  if (!project) notFound();
  const [t, tt] = await Promise.all([getTranslations("projects"), getTranslations("timeline")]);
  const today = todayIn(viewer.user.timezone);

  const anchorParam = typeof sp.anchor === "string" && isCalendarDate(sp.anchor) ? (sp.anchor as CalendarDate) : today;
  const from = anchorParam;
  const to = addDays(from, WINDOW_DAYS - 1);

  const taskId = typeof sp.task === "string" ? sp.task : null;
  const deletedId = typeof sp.deleted === "string" ? sp.deleted : null;
  const filters = parsePlannerFilters(sp);
  const filterScope = project.scope === "WORKSPACE" && project.workspaceId ? ({ scope: "WORKSPACE", workspaceId: project.workspaceId } as const) : ({ scope: "PERSONAL" } as const);

  const [window, detail, projects, filterLabelOptions, filterMembers] = await Promise.all([
    getTimelineTasks(viewer, project.id, { from, to }, filters),
    taskId ? getTaskDetail(viewer, taskId) : null,
    taskId ? listProjectOptions(viewer) : [],
    listLabels(viewer, filterScope),
    project.workspaceId ? listMembers(viewer, project.workspaceId) : Promise.resolve(null),
  ]);
  if (!window) notFound();
  const [members, labelOptions, comments, mentionCandidates, reminder, milestoneOptions] = await Promise.all([
    getAssignableMembers(viewer, detail),
    getTaskLabelOptions(viewer, detail),
    detail ? listTaskComments(viewer, detail.id) : [],
    detail ? getMentionCandidates(viewer, detail.id) : [],
    detail ? getMyReminder(viewer, detail.id) : null,
    listMilestoneOptions(viewer, detail?.project?.id ?? null),
  ]);
  const memberOptions = (filterMembers ?? []).map((m) => ({ id: m.user.id, name: m.user.name }));

  const hrefFor = (anchor: CalendarDate | null) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (key === "anchor" || key === "task" || key === "deleted" || value === undefined) continue;
      qs.set(key, Array.isArray(value) ? value[0] : value);
    }
    if (anchor && anchor !== today) qs.set("anchor", anchor);
    const q = qs.toString();
    return q ? `/projects/${project.id}/timeline?${q}` : `/projects/${project.id}/timeline`;
  };

  return (
    <>
      <ProjectHeader project={project} active="timeline" />
      <Panel aria-labelledby="timeline-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="timeline-heading" className="text-[13px] font-medium text-foreground-muted">
            {t("tabs.timeline")}
          </h2>
          <nav aria-label={tt("heading")} className="flex items-center gap-1.5">
            <Link href={hrefFor(addDays(from, -STEP_DAYS))} className="inline-flex size-8 items-center justify-center rounded-full ring-1 ring-border-subtle hover:bg-surface-elevated" aria-label={tt("previous")}>
              <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
            <Link href={hrefFor(null)} className="h-8 rounded-full px-3 text-[12.5px] leading-8 ring-1 ring-border-subtle hover:bg-surface-elevated">
              {tt("today")}
            </Link>
            <Link href={hrefFor(addDays(from, STEP_DAYS))} className="inline-flex size-8 items-center justify-center rounded-full ring-1 ring-border-subtle hover:bg-surface-elevated" aria-label={tt("next")}>
              <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          </nav>
        </div>
        <FilterBar memberOptions={memberOptions} labelOptions={filterLabelOptions} projectOptions={[]} />
        <TimelineView tasks={window.tasks} noDateCount={window.noDateCount} from={from} to={to} today={today} />
      </Panel>

      {detail && (
        <TaskSheet
          key={detail.id}
          task={detail}
          projects={projects}
          members={members}
          labelOptions={labelOptions}
          milestoneOptions={milestoneOptions}
          comments={comments}
          mentionCandidates={mentionCandidates}
          currentUser={{ id: viewer.user.id, name: viewer.user.name, avatarUrl: viewer.user.avatarUrl }}
          reminder={reminder}
          today={today}
          timezone={viewer.user.timezone}
        />
      )}
      {deletedId && <UndoDeleteBanner taskId={deletedId} />}
    </>
  );
}
