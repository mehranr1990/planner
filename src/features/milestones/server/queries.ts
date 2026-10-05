import "server-only";
import { fromDbDate, todayIn, toDbDate } from "@/lib/time";
import { db } from "@/server/db";
import type { Viewer } from "@/server/context";
import { canEditProject, findVisibleProject } from "@/features/projects/server/access";
import type { MilestoneOption, MilestoneSummary } from "../types";

export async function getMilestones(viewer: Viewer, projectId: string): Promise<MilestoneSummary[] | null> {
  const project = await findVisibleProject(viewer, projectId);
  if (!project) return null;
  const today = toDbDate(todayIn(viewer.user.timezone));
  const canEdit = canEditProject(viewer, project);
  const rows = await db.milestone.findMany({
    where: { projectId, archivedAt: null },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      dueOn: true,
      status: true,
      tasks: { where: { deletedAt: null, parentId: null }, select: { status: true } },
    },
  });
  return rows.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    dueOn: m.dueOn ? fromDbDate(m.dueOn) : null,
    status: m.status,
    isOverdue: m.status === "OPEN" && m.dueOn !== null && m.dueOn < today,
    progress: { done: m.tasks.filter((t) => t.status === "DONE").length, total: m.tasks.length },
    canEdit,
  }));
}

/** Options for the TaskSheet's milestone picker — scoped to one project; empty for a task with no
 * project (milestones only ever belong to a project). */
export async function listMilestoneOptions(viewer: Viewer, projectId: string | null): Promise<MilestoneOption[]> {
  if (!projectId) return [];
  const project = await findVisibleProject(viewer, projectId);
  if (!project) return [];
  const rows = await db.milestone.findMany({
    where: { projectId, archivedAt: null },
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }],
    select: { id: true, title: true },
  });
  return rows;
}
