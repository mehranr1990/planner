import "server-only";
import { db } from "@/server/db";
import type { Viewer } from "@/server/context";
import type { NotificationItem } from "../types";

const LIST_LIMIT = 20;

/** Newest first, scoped to the viewer — never trust a recipient id from the client. */
export async function listNotifications(viewer: Viewer): Promise<NotificationItem[]> {
  const rows = await db.notification.findMany({
    where: { recipientId: viewer.user.id },
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
    select: { id: true, type: true, title: true, deepLink: true, readAt: true, createdAt: true, actor: { select: { id: true, name: true, avatarUrl: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    deepLink: r.deepLink,
    actor: r.actor,
    readAt: r.readAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getUnreadNotificationCount(viewer: Viewer): Promise<number> {
  return db.notification.count({ where: { recipientId: viewer.user.id, readAt: null } });
}
