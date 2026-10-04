import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { can } from "@/server/permissions/capabilities";
import { actorIn, type Viewer } from "@/server/context";

export type LabelContext = { scope: "PERSONAL" } | { scope: "WORKSPACE"; workspaceId: string };

const policySelect = {
  id: true,
  scope: true,
  workspaceId: true,
  ownerId: true,
  archivedAt: true,
} satisfies Prisma.LabelSelect;

export type LabelPolicyRecord = Prisma.LabelGetPayload<{ select: typeof policySelect }>;

/** Loads a label only if the viewer may see it (own personal label, or any active member of its workspace). */
export async function findVisibleLabel(viewer: Viewer, labelId: string): Promise<LabelPolicyRecord | null> {
  const label = await db.label.findUnique({ where: { id: labelId }, select: policySelect });
  if (!label) return null;
  if (label.scope === "PERSONAL") return label.ownerId === viewer.user.id ? label : null;
  const actor = label.workspaceId ? actorIn(viewer, label.workspaceId) : null;
  return actor ? label : null;
}

/** Anyone who can create tasks in a context can create labels there; personal labels need no capability. */
export function canCreateLabel(viewer: Viewer, context: LabelContext): boolean {
  if (context.scope === "PERSONAL") return true;
  return can(actorIn(viewer, context.workspaceId), "tasks.create");
}

/** Rename/archive: the label's creator, or a workspace manager (shared taxonomy, not a free-for-all). */
export function canManageLabel(viewer: Viewer, label: LabelPolicyRecord): boolean {
  if (label.ownerId === viewer.user.id) return true;
  if (label.scope === "PERSONAL") return false;
  const actor = label.workspaceId ? actorIn(viewer, label.workspaceId) : null;
  return can(actor, "workspace.manage");
}
