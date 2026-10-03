import "server-only";
import { NOT_FOUND } from "@/lib/action-result";
import { recordActivity, recordAudit } from "@/server/activity";
import { db } from "@/server/db";
import { DomainError } from "@/server/errors";
import { actorIn, type Viewer } from "@/server/context";
import { can } from "@/server/permissions/capabilities";
import { canEditProject, findVisibleProject } from "./access";

export type ProjectColor = "blue" | "red" | "yellow" | "green" | "peach" | "slate";
export type ProjectStatusValue = "PLANNED" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
export type ProjectHealthValue = "ON_TRACK" | "AT_RISK" | "OFF_TRACK";

export interface CreateProjectInput {
  name: string;
  description: string | null;
  color: ProjectColor;
  /** "personal" or a workspace id — verified against the viewer's memberships. */
  context: string;
  visibility: "PRIVATE" | "WORKSPACE";
}

export async function createProject(viewer: Viewer, input: CreateProjectInput): Promise<{ id: string }> {
  const me = viewer.user.id;
  const personal = input.context === "personal";
  if (!personal && !can(actorIn(viewer, input.context), "projects.create")) throw new DomainError("cannotCreateProjectsHere");

  return db.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        name: input.name,
        description: input.description,
        color: input.color,
        scope: personal ? "PERSONAL" : "WORKSPACE",
        workspaceId: personal ? null : input.context,
        // Personal projects are always private; visibility only means something in a workspace.
        visibility: personal ? "PRIVATE" : input.visibility,
        ownerId: me,
        createdById: me,
        // The creator is the project lead; personal projects have no member list.
        members: personal ? undefined : { create: { userId: me, role: "LEAD" } },
      },
      select: { id: true, workspaceId: true },
    });
    await recordActivity(tx, { workspaceId: p.workspaceId, actorId: me, entityType: "project", entityId: p.id, action: "created" });
    return { id: p.id };
  });
}

async function loadEditableProject(viewer: Viewer, projectId: string) {
  const project = await findVisibleProject(viewer, projectId);
  if (!project || !canEditProject(viewer, project)) throw new DomainError(NOT_FOUND);
  return project;
}

/** Status/health change; workspace projects also get an audit event (§84). */
export async function updateProjectStatus(viewer: Viewer, projectId: string, change: { status?: ProjectStatusValue; health?: ProjectHealthValue }) {
  const project = await loadEditableProject(viewer, projectId);
  await db.$transaction(async (tx) => {
    const before = await tx.project.findUniqueOrThrow({ where: { id: project.id }, select: { status: true, health: true } });
    const after = { status: change.status ?? before.status, health: change.health ?? before.health };
    await tx.project.update({ where: { id: project.id }, data: after });
    await recordActivity(tx, { workspaceId: project.workspaceId, actorId: viewer.user.id, entityType: "project", entityId: project.id, action: "status_changed", data: { before, after: change } });
    if (project.workspaceId) {
      await recordAudit(tx, { workspaceId: project.workspaceId, actorId: viewer.user.id, action: "project.status_changed", targetType: "project", targetId: project.id, before, after });
    }
  });
}

export async function setProjectArchived(viewer: Viewer, projectId: string, archived: boolean) {
  const project = await loadEditableProject(viewer, projectId);
  await db.$transaction(async (tx) => {
    await tx.project.update({ where: { id: project.id }, data: { archivedAt: archived ? new Date() : null } });
    await recordActivity(tx, { workspaceId: project.workspaceId, actorId: viewer.user.id, entityType: "project", entityId: project.id, action: archived ? "archived" : "restored" });
  });
}
