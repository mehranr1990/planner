import "server-only";
import { needsRebalance, rankBetween, reseedRun } from "@/features/tasks/domain/ranking";
import { NOT_FOUND } from "@/lib/action-result";
import { recordActivity } from "@/server/activity";
import { db, type Tx } from "@/server/db";
import { DomainError } from "@/server/errors";
import type { Viewer } from "@/server/context";
import { canEditProject, findVisibleProject } from "./access";

// Board columns (Batch 5). `ProjectSection` already existed (schema-only since Phase 2) with the
// same fractional-index `sortOrder` pattern Batch 4 proved out for tasks — this file is that
// pattern's second consumer, reusing `domain/ranking.ts`'s pure math directly rather than a new
// ranking strategy (sections and tasks are different tables, so the bounded-rebalance wrapper
// around them is necessarily a parallel implementation, not a shared function — `tasks/server/
// service.ts`'s `computeRankInScope` does the same thing for `Task` rows).

const MAX_SECTIONS = 100;
const sectionSiblingSelect = { id: true, sortOrder: true } as const;
const SECTION_NEIGHBORHOOD = 20;

async function loadEditableProject(viewer: Viewer, projectId: string) {
  const project = await findVisibleProject(viewer, projectId);
  if (!project || !canEditProject(viewer, project)) throw new DomainError(NOT_FOUND);
  return project;
}

async function loadEditableSection(viewer: Viewer, sectionId: string) {
  const section = await db.projectSection.findUnique({ where: { id: sectionId }, select: { id: true, projectId: true, name: true, archivedAt: true } });
  if (!section || section.archivedAt) throw new DomainError(NOT_FOUND);
  const project = await loadEditableProject(viewer, section.projectId);
  return { section, project };
}

export async function listSections(viewer: Viewer, projectId: string) {
  const project = await findVisibleProject(viewer, projectId);
  if (!project) throw new DomainError(NOT_FOUND);
  return db.projectSection.findMany({ where: { projectId, archivedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, sortOrder: true } });
}

export async function createSection(viewer: Viewer, projectId: string, name: string) {
  const project = await loadEditableProject(viewer, projectId);
  const [count, last] = await Promise.all([
    db.projectSection.count({ where: { projectId, archivedAt: null } }),
    db.projectSection.findFirst({ where: { projectId, archivedAt: null }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } }),
  ]);
  if (count >= MAX_SECTIONS) throw new DomainError("tooManySections");
  return db.$transaction(async (tx) => {
    const section = await tx.projectSection.create({ data: { projectId, name, sortOrder: rankBetween(last?.sortOrder ?? null, null) } });
    await recordActivity(tx, { workspaceId: project.workspaceId, actorId: viewer.user.id, entityType: "project", entityId: projectId, action: "section_created", data: { sectionId: section.id, name } });
    return section;
  });
}

export async function renameSection(viewer: Viewer, sectionId: string, name: string) {
  const { section, project } = await loadEditableSection(viewer, sectionId);
  await db.$transaction(async (tx) => {
    await tx.projectSection.update({ where: { id: sectionId }, data: { name } });
    await recordActivity(tx, {
      workspaceId: project.workspaceId,
      actorId: viewer.user.id,
      entityType: "project",
      entityId: project.id,
      action: "section_renamed",
      data: { sectionId, from: section.name, to: name },
    });
  });
}

/** Soft-archives the column; its tasks fall back to the unsectioned column rather than vanishing. */
export async function archiveSection(viewer: Viewer, sectionId: string) {
  const { section, project } = await loadEditableSection(viewer, sectionId);
  await db.$transaction(async (tx) => {
    await tx.projectSection.update({ where: { id: sectionId }, data: { archivedAt: new Date() } });
    await tx.task.updateMany({ where: { sectionId, deletedAt: null }, data: { sectionId: null, version: { increment: 1 } } });
    await recordActivity(tx, {
      workspaceId: project.workspaceId,
      actorId: viewer.user.id,
      entityType: "project",
      entityId: project.id,
      action: "section_archived",
      data: { sectionId, name: section.name },
    });
  });
}

/** Bounded neighborhood around the drop point (same shape as `tasks/server/service.ts`'s
 * `fetchNeighborhood`, against `ProjectSection` instead of `Task`) — never the whole column list. */
async function fetchSectionNeighborhood(tx: Tx, projectId: string, excludeId: string, beforeId: string | null, afterId: string | null) {
  const where = { projectId, archivedAt: null, id: { not: excludeId } };
  const orderBy = [{ sortOrder: "asc" as const }];
  const [forward, backward] = await Promise.all([
    afterId ? tx.projectSection.findMany({ where, orderBy, cursor: { id: afterId }, take: SECTION_NEIGHBORHOOD, select: sectionSiblingSelect }) : Promise.resolve([]),
    beforeId ? tx.projectSection.findMany({ where, orderBy, cursor: { id: beforeId }, take: -SECTION_NEIGHBORHOOD, select: sectionSiblingSelect }) : Promise.resolve([]),
  ]);
  const byId = new Map([...backward, ...forward].map((r) => [r.id, r]));
  return [...byId.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Reorders a board column among its project's other columns — same server-side, bounded-rebalance
 * shape Batch 4 established for tasks, computed entirely from the two visible neighbor ids. */
export async function reorderSection(viewer: Viewer, sectionId: string, position: { beforeId: string | null; afterId: string | null }) {
  const { section, project } = await loadEditableSection(viewer, sectionId);
  await db.$transaction(async (tx) => {
    const scopeWhere = { projectId: section.projectId, archivedAt: null };
    const [before, after] = await Promise.all([
      position.beforeId ? tx.projectSection.findFirst({ where: { ...scopeWhere, id: position.beforeId }, select: sectionSiblingSelect }) : null,
      position.afterId ? tx.projectSection.findFirst({ where: { ...scopeWhere, id: position.afterId }, select: sectionSiblingSelect }) : null,
    ]);
    let beforeRank = before?.sortOrder ?? null;
    let afterRank = after?.sortOrder ?? null;

    if (needsRebalance(beforeRank, afterRank)) {
      const neighborhood = await fetchSectionNeighborhood(tx, section.projectId, section.id, position.beforeId, position.afterId);
      const seeded = reseedRun(neighborhood.length);
      await Promise.all(neighborhood.map((row, i) => tx.projectSection.update({ where: { id: row.id }, data: { sortOrder: seeded[i] } })));
      const dropIndex = position.afterId ? neighborhood.findIndex((r) => r.id === position.afterId) : neighborhood.length;
      beforeRank = dropIndex > 0 ? seeded[dropIndex - 1] : null;
      afterRank = dropIndex >= 0 && dropIndex < neighborhood.length ? seeded[dropIndex] : null;
    }

    const sortOrder = rankBetween(beforeRank, afterRank);
    await tx.projectSection.update({ where: { id: section.id }, data: { sortOrder } });
    await recordActivity(tx, { workspaceId: project.workspaceId, actorId: viewer.user.id, entityType: "project", entityId: project.id, action: "section_reordered", data: { sectionId: section.id } });
  });
}
