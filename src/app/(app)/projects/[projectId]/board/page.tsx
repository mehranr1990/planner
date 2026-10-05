import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Panel } from "@/components/ui/surface";
import { todayIn } from "@/lib/time";
import { ProjectHeader } from "@/features/projects/components/project-tabs";
import { BoardView } from "@/features/projects/components/board/board-view";
import { getProject, listProjectOptions } from "@/features/projects/server/queries";
import { getMentionCandidates, listTaskComments } from "@/features/collaboration/server/queries";
import { listLabels } from "@/features/labels/server/queries";
import { listMilestoneOptions } from "@/features/milestones/server/queries";
import { getMyReminder } from "@/features/reminders/server/queries";
import { FilterBar } from "@/features/tasks/components/filter-bar";
import { QuickAdd } from "@/features/tasks/components/quick-add";
import { TaskSheet } from "@/features/tasks/components/task-sheet";
import { UndoDeleteBanner } from "@/features/tasks/components/undo-delete-banner";
import { parsePlannerFilters } from "@/features/tasks/server/filters";
import { getAssignableMembers, getBoardData, getTaskDetail, getTaskLabelOptions } from "@/features/tasks/server/queries";
import { listMembers } from "@/features/workspace/server/queries";
import { getViewer } from "@/server/context";

export async function generateMetadata({ params }: PageProps<"/projects/[projectId]/board">): Promise<Metadata> {
  const { projectId } = await params;
  const viewer = await getViewer();
  const project = await getProject(viewer, projectId);
  const [t, tt] = await Promise.all([getTranslations("projects"), getTranslations("projects.tabs")]);
  return { title: project ? `${project.name} · ${tt("board")}` : t("title") };
}

export default async function BoardPage({ params, searchParams }: PageProps<"/projects/[projectId]/board">) {
  const { projectId } = await params;
  const sp = await searchParams;
  const viewer = await getViewer();
  const project = await getProject(viewer, projectId);
  if (!project) notFound();
  const [t, tc] = await Promise.all([getTranslations("projects"), getTranslations("tasks")]);
  const today = todayIn(viewer.user.timezone);

  const taskId = typeof sp.task === "string" ? sp.task : null;
  const deletedId = typeof sp.deleted === "string" ? sp.deleted : null;
  const filters = parsePlannerFilters(sp);
  const filterScope = project.scope === "WORKSPACE" && project.workspaceId ? ({ scope: "WORKSPACE", workspaceId: project.workspaceId } as const) : ({ scope: "PERSONAL" } as const);

  const [board, detail, projects, filterLabelOptions, filterMembers] = await Promise.all([
    getBoardData(viewer, project.id, filters),
    taskId ? getTaskDetail(viewer, taskId) : null,
    taskId ? listProjectOptions(viewer) : [],
    listLabels(viewer, filterScope),
    project.workspaceId ? listMembers(viewer, project.workspaceId) : Promise.resolve(null),
  ]);
  if (!board) notFound();
  const [members, labelOptions, comments, mentionCandidates, reminder, milestoneOptions] = await Promise.all([
    getAssignableMembers(viewer, detail),
    getTaskLabelOptions(viewer, detail),
    detail ? listTaskComments(viewer, detail.id) : [],
    detail ? getMentionCandidates(viewer, detail.id) : [],
    detail ? getMyReminder(viewer, detail.id) : null,
    listMilestoneOptions(viewer, detail?.project?.id ?? null),
  ]);
  const memberOptions = (filterMembers ?? []).map((m) => ({ id: m.user.id, name: m.user.name }));

  return (
    <>
      <ProjectHeader project={project} active="board" />
      <Panel aria-labelledby="board-heading">
        <h2 id="board-heading" className="sr-only">
          {t("tabs.board")}
        </h2>
        {project.canAddTasks && (
          <div className="mb-3">
            <QuickAdd today={today} contexts={[]} defaultContext={project.workspaceId ?? "personal"} projectId={project.id} placeholder={tc("quickAdd.placeholderProject", { project: project.name })} />
          </div>
        )}
        <FilterBar memberOptions={memberOptions} labelOptions={filterLabelOptions} projectOptions={[]} />
        <BoardView projectId={project.id} columns={board.columns} today={today} timezone={viewer.user.timezone} canEditProject={project.canEdit} />
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
