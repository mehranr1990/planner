import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { needsRebalance, rankBetween, reseedRun } from "@/features/tasks/domain/ranking";
import { NOT_FOUND } from "@/lib/action-result";
import { toDbDate, type CalendarDate } from "@/lib/time";
import { recordActivity } from "@/server/activity";
import { db, type Tx } from "@/server/db";
import { DomainError } from "@/server/errors";
import type { Viewer } from "@/server/context";
import { canEditProject, findVisibleProject } from "@/features/projects/server/access";
import { canEditMilestone, findVisibleMilestone } from "./access";

// Milestones (Batch 5, §9): a dated target within a project. `sortOrder` reuses the exact
// fractional-index strategy `domain/ranking.ts` already proved out for tasks (Batch 4) and board
// columns (this batch's `projects/server/sections.ts`) — a third consumer of the same pure math,
// never a new ranking approach.

async function loadEditableProject(viewer: Viewer, projectId: string) {
  const project = await findVisibleProject(viewer, projectId);
  if (!project || !canEditProject(viewer, project)) throw new DomainError(NOT_FOUND);
  return project;
}

async function loadEditableMilestone(viewer: Viewer, milestoneId: string) {
  const found = await findVisibleMilestone(viewer, milestoneId);
  if (!found || !canEditMilestone(viewer, found.project)) throw new DomainError(NOT_FOUND);
  return found;
}

export interface MilestoneInput {
  title: string;
  description: string | null;
  dueOn: CalendarDate | null;
}

export async function createMilestone(viewer: Viewer, projectId: string, input: MilestoneInput) {
  const project = await loadEditableProject(viewer, projectId);
  const last = await db.milestone.findFirst({ where: { projectId, archivedAt: null }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  return db.$transaction(async (tx) => {
    const milestone = await tx.milestone.create({
      data: {
        projectId,
        title: input.title,
        description: input.description,
        dueOn: input.dueOn ? toDbDate(input.dueOn) : null,
        createdById: viewer.user.id,
        sortOrder: rankBetween(last?.sortOrder ?? null, null),
      },
    });
    await recordActivity(tx, { workspaceId: project.workspaceId, actorId: viewer.user.id, entityType: "milestone", entityId: milestone.id, action: "created", data: { projectId, title: input.title } });
    return { id: milestone.id };
  });
}

export async function updateMilestone(viewer: Viewer, milestoneId: string, input: Partial<MilestoneInput>) {
  const { milestone, project } = await loadEditableMilestone(viewer, milestoneId);
  const data: Prisma.MilestoneUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.dueOn !== undefined) data.dueOn = input.dueOn ? toDbDate(input.dueOn) : null;
  if (Object.keys(data).length === 0) return;
  await db.$transaction(async (tx) => {
    await tx.milestone.update({ where: { id: milestone.id }, data });
    await recordActivity(tx, { workspaceId: project.workspaceId, actorId: viewer.user.id, entityType: "milestone", entityId: milestone.id, action: "updated" });
  });
}

export async function setMilestoneCompletion(viewer: Viewer, milestoneId: string, done: boolean) {
  const { milestone, project } = await loadEditableMilestone(viewer, milestoneId);
  const current = await db.milestone.findUniqueOrThrow({ where: { id: milestone.id }, select: { status: true } });
  if ((current.status === "COMPLETED") === done) return; // idempotent toggle
  await db.$transaction(async (tx) => {
    await tx.milestone.update({
      where: { id: milestone.id },
      data: done ? { status: "COMPLETED", completedAt: new Date() } : { status: "OPEN", completedAt: null },
    });
    await recordActivity(tx, { workspaceId: project.workspaceId, actorId: viewer.user.id, entityType: "milestone", entityId: milestone.id, action: done ? "completed" : "reopened" });
  });
}

/** Soft-archives the milestone; linked tasks fall back to unlinked rather than vanishing (same
 * shape as `archiveSection`). */
export async function archiveMilestone(viewer: Viewer, milestoneId: string) {
  const { milestone, project } = await loadEditableMilestone(viewer, milestoneId);
  await db.$transaction(async (tx) => {
    await tx.milestone.update({ where: { id: milestoneId }, data: { archivedAt: new Date() } });
    await tx.task.updateMany({ where: { milestoneId, deletedAt: null }, data: { milestoneId: null, version: { increment: 1 } } });
    await recordActivity(tx, { workspaceId: project.workspaceId, actorId: viewer.user.id, entityType: "milestone", entityId: milestone.id, action: "deleted" });
  });
}

const siblingSelect = { id: true, sortOrder: true } as const;
const NEIGHBORHOOD = 20;

async function fetchNeighborhood(tx: Tx, projectId: string, excludeId: string, beforeId: string | null, afterId: string | null) {
  const where = { projectId, archivedAt: null, id: { not: excludeId } };
  const orderBy = [{ sortOrder: "asc" as const }];
  const [forward, backward] = await Promise.all([
    afterId ? tx.milestone.findMany({ where, orderBy, cursor: { id: afterId }, take: NEIGHBORHOOD, select: siblingSelect }) : Promise.resolve([]),
    beforeId ? tx.milestone.findMany({ where, orderBy, cursor: { id: beforeId }, take: -NEIGHBORHOOD, select: siblingSelect }) : Promise.resolve([]),
  ]);
  const byId = new Map([...backward, ...forward].map((r) => [r.id, r]));
  return [...byId.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function reorderMilestone(viewer: Viewer, milestoneId: string, position: { beforeId: string | null; afterId: string | null }) {
  const { milestone, project } = await loadEditableMilestone(viewer, milestoneId);
  await db.$transaction(async (tx) => {
    const scopeWhere = { projectId: milestone.projectId, archivedAt: null };
    const [before, after] = await Promise.all([
      position.beforeId ? tx.milestone.findFirst({ where: { ...scopeWhere, id: position.beforeId }, select: siblingSelect }) : null,
      position.afterId ? tx.milestone.findFirst({ where: { ...scopeWhere, id: position.afterId }, select: siblingSelect }) : null,
    ]);
    let beforeRank = before?.sortOrder ?? null;
    let afterRank = after?.sortOrder ?? null;

    if (needsRebalance(beforeRank, afterRank)) {
      const neighborhood = await fetchNeighborhood(tx, milestone.projectId, milestone.id, position.beforeId, position.afterId);
      const seeded = reseedRun(neighborhood.length);
      await Promise.all(neighborhood.map((row, i) => tx.milestone.update({ where: { id: row.id }, data: { sortOrder: seeded[i] } })));
      const dropIndex = position.afterId ? neighborhood.findIndex((r) => r.id === position.afterId) : neighborhood.length;
      beforeRank = dropIndex > 0 ? seeded[dropIndex - 1] : null;
      afterRank = dropIndex >= 0 && dropIndex < neighborhood.length ? seeded[dropIndex] : null;
    }

    const sortOrder = rankBetween(beforeRank, afterRank);
    await tx.milestone.update({ where: { id: milestone.id }, data: { sortOrder } });
    await recordActivity(tx, { workspaceId: project.workspaceId, actorId: viewer.user.id, entityType: "milestone", entityId: milestone.id, action: "reordered" });
  });
}
