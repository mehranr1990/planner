import "server-only";
import { db } from "@/server/db";
import type { Viewer } from "@/server/context";

/** Scoped to `recipientId: viewer.user.id` — a client-supplied id for someone else's notification just matches zero rows. */
export async function markNotificationRead(viewer: Viewer, notificationId: string) {
  await db.notification.updateMany({ where: { id: notificationId, recipientId: viewer.user.id, readAt: null }, data: { readAt: new Date() } });
}

export async function markAllNotificationsRead(viewer: Viewer) {
  await db.notification.updateMany({ where: { recipientId: viewer.user.id, readAt: null }, data: { readAt: new Date() } });
}
