import "server-only";
import { NOT_FOUND } from "@/lib/action-result";
import { recordAudit } from "@/server/activity";
import { actorIn, type Viewer } from "@/server/context";
import { db, isUniqueViolation } from "@/server/db";
import { DomainError } from "@/server/errors";
import { CAPABILITIES, isCapability, type BaseRole } from "@/server/permissions/capabilities";
import { canManageRoles } from "./access";

async function requireRoleManager(viewer: Viewer, workspaceId: string) {
  const actor = actorIn(viewer, workspaceId);
  if (!actor) throw new DomainError(NOT_FOUND);
  if (!canManageRoles(actor)) throw new DomainError("roleManageForbidden");
  return actor;
}

/** Owner-only capabilities (currently just workspace.delete) can never be granted to a custom role. */
function sanitizeCapabilities(capabilities: readonly string[]): string[] {
  return capabilities.filter((c) => isCapability(c) && c !== "workspace.delete");
}

export async function createCustomRole(
  viewer: Viewer,
  input: { workspaceId: string; name: string; baseRole: BaseRole; capabilities: string[] },
): Promise<{ id: string }> {
  await requireRoleManager(viewer, input.workspaceId);
  try {
    const role = await db.workspaceRole.create({
      data: { workspaceId: input.workspaceId, name: input.name, baseRole: input.baseRole, capabilities: sanitizeCapabilities(input.capabilities) },
      select: { id: true },
    });
    await db.auditEvent.create({ data: { workspaceId: input.workspaceId, actorId: viewer.user.id, action: "role.created", targetType: "workspace_role", targetId: role.id } });
    return role;
  } catch (e) {
    if (isUniqueViolation(e)) throw new DomainError("roleNameTaken");
    throw e;
  }
}

async function requireRole(viewer: Viewer, roleId: string) {
  const role = await db.workspaceRole.findUnique({ where: { id: roleId }, select: { id: true, workspaceId: true } });
  if (!role) throw new DomainError(NOT_FOUND);
  await requireRoleManager(viewer, role.workspaceId);
  return role;
}

export async function updateCustomRole(viewer: Viewer, input: { roleId: string; name?: string; capabilities?: string[] }): Promise<void> {
  const role = await requireRole(viewer, input.roleId);
  try {
    await db.$transaction(async (tx) => {
      await tx.workspaceRole.update({
        where: { id: role.id },
        data: { name: input.name, capabilities: input.capabilities ? sanitizeCapabilities(input.capabilities) : undefined },
      });
      await recordAudit(tx, { workspaceId: role.workspaceId, actorId: viewer.user.id, action: "role.updated", targetType: "workspace_role", targetId: role.id });
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new DomainError("roleNameTaken");
    throw e;
  }
}

/** Deleting a role in use reassigns affected memberships to its base role first, in one transaction. */
export async function deleteCustomRole(viewer: Viewer, roleId: string): Promise<void> {
  const role = await requireRole(viewer, roleId);
  await db.$transaction(async (tx) => {
    const full = await tx.workspaceRole.findUniqueOrThrow({ where: { id: role.id }, select: { baseRole: true } });
    await tx.membership.updateMany({ where: { customRoleId: role.id }, data: { customRoleId: null, role: full.baseRole } });
    await tx.workspaceRole.delete({ where: { id: role.id } });
    await recordAudit(tx, { workspaceId: role.workspaceId, actorId: viewer.user.id, action: "role.deleted", targetType: "workspace_role", targetId: role.id });
  });
}

/** Assigns (or clears, when customRoleId is null) a custom role on a membership. */
export async function assignCustomRole(viewer: Viewer, input: { workspaceId: string; userId: string; customRoleId: string | null }): Promise<void> {
  const actor = await requireRoleManager(viewer, input.workspaceId);
  if (actor.userId === input.userId) throw new DomainError("roleChangeForbidden"); // no self-assignment, mirrors canChangeRole

  await db.$transaction(async (tx) => {
    const membership = await tx.membership.findUnique({ where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId } }, select: { id: true, role: true } });
    if (!membership || membership.role === "OWNER") throw new DomainError(NOT_FOUND);

    let nextRole: BaseRole = membership.role as BaseRole;
    if (input.customRoleId) {
      const role = await tx.workspaceRole.findUnique({ where: { id: input.customRoleId }, select: { workspaceId: true, baseRole: true } });
      if (!role || role.workspaceId !== input.workspaceId) throw new DomainError(NOT_FOUND);
      nextRole = role.baseRole;
    }
    await tx.membership.update({ where: { id: membership.id }, data: { customRoleId: input.customRoleId, role: nextRole } });
    await recordAudit(tx, { workspaceId: input.workspaceId, actorId: viewer.user.id, action: "member.role_changed", targetType: "membership", targetId: membership.id, after: { customRoleId: input.customRoleId } });
  });
}

export { CAPABILITIES };
