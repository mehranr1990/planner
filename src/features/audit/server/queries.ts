import "server-only";
import { db } from "@/server/db";
import { actorIn, type Viewer } from "@/server/context";
import { can } from "@/server/permissions/capabilities";

const PAGE_SIZE = 50;

export async function listAuditEvents(viewer: Viewer, workspaceId: string, cursor?: string) {
  const actor = actorIn(viewer, workspaceId);
  if (!can(actor, "audit.view")) return null;
  const events = await db.auditEvent.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      before: true,
      after: true,
      createdAt: true,
      actor: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
  const hasMore = events.length > PAGE_SIZE;
  const page = hasMore ? events.slice(0, PAGE_SIZE) : events;
  return {
    events: page.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}
