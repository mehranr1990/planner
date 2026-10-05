import "server-only";
import { db } from "@/server/db";
import type { Viewer } from "@/server/context";
import { canEditProject, findVisibleProject, type ProjectPolicyRecord } from "@/features/projects/server/access";

// Milestones have no capability or role of their own — a milestone is exactly as editable as the
// project it belongs to (the same precedent `ProjectSection`/board columns follow). Visibility
// likewise inherits the project's: anyone who can see the project can see its milestones.

export interface MilestonePolicyRecord {
  id: string;
  projectId: string;
  archivedAt: Date | null;
}

export async function findVisibleMilestone(viewer: Viewer, milestoneId: string): Promise<{ milestone: MilestonePolicyRecord; project: ProjectPolicyRecord } | null> {
  const milestone = await db.milestone.findUnique({ where: { id: milestoneId }, select: { id: true, projectId: true, archivedAt: true } });
  if (!milestone || milestone.archivedAt) return null;
  const project = await findVisibleProject(viewer, milestone.projectId);
  if (!project) return null;
  return { milestone, project };
}

export function canEditMilestone(viewer: Viewer, project: ProjectPolicyRecord): boolean {
  return canEditProject(viewer, project);
}
