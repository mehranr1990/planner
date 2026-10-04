import "server-only";
import { NOT_FOUND } from "@/lib/action-result";
import { recordAudit } from "@/server/activity";
import { actorIn, type Viewer } from "@/server/context";
import { db, isUniqueViolation } from "@/server/db";
import { DomainError } from "@/server/errors";
import { canManageTeams } from "./access";

async function requireTeamManager(viewer: Viewer, workspaceId: string) {
  const actor = actorIn(viewer, workspaceId);
  if (!actor) throw new DomainError(NOT_FOUND);
  if (!canManageTeams(actor)) throw new DomainError("teamForbidden");
  return actor;
}

export async function createTeam(viewer: Viewer, input: { workspaceId: string; name: string; description?: string }): Promise<{ id: string }> {
  await requireTeamManager(viewer, input.workspaceId);
  try {
    const team = await db.team.create({
      data: { workspaceId: input.workspaceId, name: input.name, description: input.description },
      select: { id: true },
    });
    await db.auditEvent.create({
      data: { workspaceId: input.workspaceId, actorId: viewer.user.id, action: "team.created", targetType: "team", targetId: team.id },
    });
    return team;
  } catch (e) {
    if (isUniqueViolation(e)) throw new DomainError("teamNameTaken");
    throw e;
  }
}

async function requireTeam(viewer: Viewer, teamId: string) {
  const team = await db.team.findUnique({ where: { id: teamId }, select: { id: true, workspaceId: true, archivedAt: true } });
  if (!team) throw new DomainError(NOT_FOUND);
  await requireTeamManager(viewer, team.workspaceId);
  return team;
}

export async function renameTeam(viewer: Viewer, input: { teamId: string; name: string; description?: string }): Promise<void> {
  const team = await requireTeam(viewer, input.teamId);
  try {
    await db.team.update({ where: { id: team.id }, data: { name: input.name, description: input.description } });
  } catch (e) {
    if (isUniqueViolation(e)) throw new DomainError("teamNameTaken");
    throw e;
  }
}

export async function archiveTeam(viewer: Viewer, teamId: string): Promise<void> {
  const team = await requireTeam(viewer, teamId);
  await db.$transaction(async (tx) => {
    await tx.team.update({ where: { id: team.id }, data: { archivedAt: new Date() } });
    await recordAudit(tx, { workspaceId: team.workspaceId, actorId: viewer.user.id, action: "team.archived", targetType: "team", targetId: team.id });
  });
}

export async function addTeamMember(viewer: Viewer, input: { teamId: string; userId: string; role?: "LEAD" | "MEMBER" }): Promise<void> {
  const team = await requireTeam(viewer, input.teamId);
  const membership = await db.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: team.workspaceId, userId: input.userId } },
    select: { status: true },
  });
  if (!membership || membership.status !== "ACTIVE") throw new DomainError(NOT_FOUND);
  await db.$transaction(async (tx) => {
    await tx.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: input.userId } },
      create: { teamId: team.id, userId: input.userId, role: input.role ?? "MEMBER" },
      update: { role: input.role ?? "MEMBER" },
    });
    await recordAudit(tx, { workspaceId: team.workspaceId, actorId: viewer.user.id, action: "team.member_added", targetType: "team", targetId: team.id, after: { userId: input.userId } });
  });
}

export async function removeTeamMember(viewer: Viewer, input: { teamId: string; userId: string }): Promise<void> {
  const team = await requireTeam(viewer, input.teamId);
  await db.$transaction(async (tx) => {
    await tx.teamMember.deleteMany({ where: { teamId: team.id, userId: input.userId } });
    await recordAudit(tx, { workspaceId: team.workspaceId, actorId: viewer.user.id, action: "team.member_removed", targetType: "team", targetId: team.id, before: { userId: input.userId } });
  });
}

export async function setTeamLead(viewer: Viewer, input: { teamId: string; userId: string; isLead: boolean }): Promise<void> {
  const team = await requireTeam(viewer, input.teamId);
  const member = await db.teamMember.findUnique({ where: { teamId_userId: { teamId: team.id, userId: input.userId } }, select: { teamId: true } });
  if (!member) throw new DomainError(NOT_FOUND);
  await db.teamMember.update({
    where: { teamId_userId: { teamId: team.id, userId: input.userId } },
    data: { role: input.isLead ? "LEAD" : "MEMBER" },
  });
}
