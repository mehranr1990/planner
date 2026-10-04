import "server-only";
import { NOT_FOUND } from "@/lib/action-result";
import { db, isUniqueViolation } from "@/server/db";
import { DomainError } from "@/server/errors";
import { actorIn, type Viewer } from "@/server/context";
import { canCreateLabel, canManageLabel, findVisibleLabel, type LabelContext } from "./access";

/** "personal" or a workspace id the viewer actually belongs to — never trust the client's claim. */
export function resolveLabelContext(viewer: Viewer, context: string): LabelContext {
  if (context === "personal") return { scope: "PERSONAL" };
  if (!actorIn(viewer, context)) throw new DomainError(NOT_FOUND);
  return { scope: "WORKSPACE", workspaceId: context };
}

export async function createLabel(viewer: Viewer, rawContext: string, name: string, color: string) {
  const context = resolveLabelContext(viewer, rawContext);
  if (!canCreateLabel(viewer, context)) throw new DomainError("cannotCreateTasksHere");
  const trimmed = name.trim();
  if (!trimmed) throw new DomainError("labelNameTooShort");
  try {
    return await db.label.create({
      data: {
        scope: context.scope,
        workspaceId: context.scope === "WORKSPACE" ? context.workspaceId : null,
        ownerId: viewer.user.id,
        name: trimmed,
        color,
      },
      select: { id: true, name: true, color: true },
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new DomainError("labelNameTaken");
    throw e;
  }
}

export async function renameLabel(viewer: Viewer, labelId: string, name: string, color: string) {
  const label = await findVisibleLabel(viewer, labelId);
  if (!label || !canManageLabel(viewer, label)) throw new DomainError(NOT_FOUND);
  const trimmed = name.trim();
  if (!trimmed) throw new DomainError("labelNameTooShort");
  try {
    await db.label.update({ where: { id: labelId }, data: { name: trimmed, color } });
  } catch (e) {
    if (isUniqueViolation(e)) throw new DomainError("labelNameTaken");
    throw e;
  }
}

export async function archiveLabel(viewer: Viewer, labelId: string) {
  const label = await findVisibleLabel(viewer, labelId);
  if (!label || !canManageLabel(viewer, label)) throw new DomainError(NOT_FOUND);
  await db.label.update({ where: { id: labelId }, data: { archivedAt: new Date() } });
}
