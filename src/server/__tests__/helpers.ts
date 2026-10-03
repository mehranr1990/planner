import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import type { Viewer } from "@/server/context";

// Shared fixtures for DB integration suites. Each suite gets its own run id and cleans up
// everything it created (users, workspaces and their history).

export const hasDatabase = Boolean(process.env.DATABASE_URL);

export function fixtureRun(tz = "Asia/Tehran") {
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const workspaceIds: string[] = [];

  async function makeUser(label: string, extra: { deactivated?: boolean } = {}) {
    const u = await db.user.create({
      data: {
        email: `${label}-${run}@test.local`,
        name: `${label} ${run}`,
        passwordHash: "x",
        timezone: tz,
        deactivatedAt: extra.deactivated ? new Date() : null,
      },
    });
    userIds.push(u.id);
    return u;
  }

  async function makeWorkspace(ownerId: string, members: { userId: string; role: "OWNER" | "ADMIN" | "MANAGER" | "MEMBER" | "GUEST" }[] = []) {
    const ws = await db.workspace.create({
      data: {
        name: `WS ${run}`,
        slug: `ws-${run}-${workspaceIds.length}`,
        createdById: ownerId,
        memberships: { create: [{ userId: ownerId, role: "OWNER" }, ...members] },
      },
    });
    workspaceIds.push(ws.id);
    return ws;
  }

  /** Mirrors getViewer() without cookies. */
  async function viewerFor(userId: string): Promise<Viewer> {
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatarUrl: true, timezone: true, locale: true, theme: true, weekStartsOn: true, activeWorkspaceId: true },
    });
    const memberships = await db.membership.findMany({
      where: { userId, status: "ACTIVE" },
      select: { role: true, customRole: { select: { capabilities: true } }, workspace: { select: { id: true, name: true, slug: true, iconUrl: true, timezone: true } } },
    });
    const workspaces = memberships.map((m) => ({
      ...m.workspace,
      actor: { userId, workspaceId: m.workspace.id, role: m.role, customCapabilities: m.customRole?.capabilities ?? null, active: true },
    }));
    return { user, workspaces, activeWorkspace: workspaces.find((w) => w.id === user.activeWorkspaceId) ?? null };
  }

  async function cleanup() {
    // Workspaces created through services (createWorkspace) are found via their creator.
    const created = await db.workspace.findMany({ where: { createdById: { in: userIds } }, select: { id: true } });
    const wsIds = [...new Set([...workspaceIds, ...created.map((w) => w.id)])];
    await db.task.deleteMany({ where: { OR: [{ ownerId: { in: userIds } }, { workspaceId: { in: wsIds } }] } });
    await db.recurrenceSeries.deleteMany({ where: { ownerId: { in: userIds } } });
    await db.label.deleteMany({ where: { ownerId: { in: userIds } } });
    await db.activity.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { workspaceId: { in: wsIds } }] } });
    await db.auditEvent.deleteMany({ where: { workspaceId: { in: wsIds } } });
    await db.project.deleteMany({ where: { ownerId: { in: userIds } } });
    await db.user.updateMany({ where: { id: { in: userIds } }, data: { activeWorkspaceId: null } });
    await db.workspace.deleteMany({ where: { id: { in: wsIds } } });
    await db.session.deleteMany({ where: { userId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  }

  return { run, userIds, workspaceIds, makeUser, makeWorkspace, viewerFor, cleanup };
}
