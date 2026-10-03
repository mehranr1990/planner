import "server-only";
import { cache } from "react";
import { requireUser, type SessionUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { can, type Capability, type WorkspaceActor } from "@/server/permissions/capabilities";

export interface ViewerWorkspace {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  timezone: string;
  actor: WorkspaceActor;
}

export interface Viewer {
  user: SessionUser;
  /** Active memberships only. Deactivated members are treated as non-members everywhere. */
  workspaces: ViewerWorkspace[];
  /** null = personal context. Always one of `workspaces` when set. */
  activeWorkspace: ViewerWorkspace | null;
}

/**
 * The authenticated viewer with resolved workspace actors. Memoised per request.
 * This is the only place memberships are turned into authorization actors.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const user = await requireUser();
  const memberships = await db.membership.findMany({
    where: { userId: user.id, status: "ACTIVE", workspace: { archivedAt: null } },
    select: {
      role: true,
      customRole: { select: { capabilities: true } },
      workspace: { select: { id: true, name: true, slug: true, iconUrl: true, timezone: true } },
    },
    orderBy: { joinedAt: "asc" },
  });
  const workspaces = memberships.map((m) => ({
    ...m.workspace,
    actor: {
      userId: user.id,
      workspaceId: m.workspace.id,
      role: m.role,
      customCapabilities: m.customRole?.capabilities ?? null,
      active: true,
    },
  }));
  return {
    user,
    workspaces,
    activeWorkspace: workspaces.find((w) => w.id === user.activeWorkspaceId) ?? null,
  };
});

export function actorIn(viewer: Viewer, workspaceId: string): WorkspaceActor | null {
  return viewer.workspaces.find((w) => w.id === workspaceId)?.actor ?? null;
}

export function viewerCan(viewer: Viewer, workspaceId: string, capability: Capability): boolean {
  return can(actorIn(viewer, workspaceId), capability);
}

export function activeWorkspaceIds(viewer: Viewer): string[] {
  return viewer.workspaces.map((w) => w.id);
}
