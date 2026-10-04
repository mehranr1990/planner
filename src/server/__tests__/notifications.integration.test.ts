import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import type { Viewer } from "@/server/context";
import { getUnreadNotificationCount, listNotifications } from "@/features/notifications/server/queries";
import * as service from "@/features/notifications/server/service";
import { fixtureRun, hasDatabase } from "./helpers";

const suite = hasDatabase ? describe : describe.skip;
const f = fixtureRun();

let alice: Viewer;
let bob: Viewer;

function makeNotification(recipientId: string, dedupeSuffix: string) {
  return db.notification.create({
    data: {
      recipientId,
      type: "TASK_DUE_SOON",
      entityType: "task",
      entityId: "t_fixture",
      title: "Fixture task",
      deepLink: "/planner/all?task=t_fixture",
      dedupeKey: `fixture:${recipientId}:${dedupeSuffix}`,
    },
  });
}

suite("notification inbox (integration)", () => {
  beforeAll(async () => {
    const [a, b] = await Promise.all([f.makeUser("alice"), f.makeUser("bob")]);
    [alice, bob] = await Promise.all([f.viewerFor(a.id), f.viewerFor(b.id)]);
  });

  afterAll(() => f.cleanup());

  it("lists only the viewer's own notifications, newest first", async () => {
    await makeNotification(alice.user.id, "1");
    await makeNotification(bob.user.id, "1"); // someone else's — must never appear for alice
    await makeNotification(alice.user.id, "2");

    const list = await listNotifications(alice);
    expect(list.map((n) => n.id)).toHaveLength(2);
    expect(new Date(list[0]!.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(list[1]!.createdAt).getTime());
  });

  it("counts unread correctly and marking one read decrements it", async () => {
    await makeNotification(alice.user.id, "unread-a");
    await makeNotification(alice.user.id, "unread-b");
    const before = await getUnreadNotificationCount(alice);
    const [target] = await listNotifications(alice);

    await service.markNotificationRead(alice, target!.id);
    const after = await getUnreadNotificationCount(alice);
    expect(after).toBe(before - 1);

    const row = await db.notification.findUniqueOrThrow({ where: { id: target!.id } });
    expect(row.readAt).not.toBeNull();
  });

  it("never lets a client-supplied notification id mark someone else's notification read", async () => {
    const theirs = await makeNotification(bob.user.id, "protected");
    await service.markNotificationRead(alice, theirs.id);
    const row = await db.notification.findUniqueOrThrow({ where: { id: theirs.id } });
    expect(row.readAt).toBeNull(); // untouched — alice has no standing over bob's notification
  });

  it("mark all read clears every unread notification for the viewer, and only the viewer", async () => {
    await makeNotification(alice.user.id, "bulk-a");
    await makeNotification(alice.user.id, "bulk-b");
    await makeNotification(bob.user.id, "bulk-c");

    await service.markAllNotificationsRead(alice);
    expect(await getUnreadNotificationCount(alice)).toBe(0);
    expect(await getUnreadNotificationCount(bob)).toBeGreaterThan(0); // bob's remain untouched
  });
});
