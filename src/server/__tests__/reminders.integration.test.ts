import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NOT_FOUND } from "@/lib/action-result";
import { db } from "@/server/db";
import type { Viewer } from "@/server/context";
import { addDays, localMinutes, todayIn, toDbDate, zonedToUtc } from "@/lib/time";
import { deliverDueReminders } from "@/features/reminders/server/engine";
import { getMyReminder } from "@/features/reminders/server/queries";
import * as reminders from "@/features/reminders/server/service";
import * as tasks from "@/features/tasks/server/service";
import { fixtureRun, hasDatabase } from "./helpers";

const suite = hasDatabase ? describe : describe.skip;
const f = fixtureRun();
const TZ = "Asia/Tehran";
const OTHER_TZ = "America/New_York"; // timezone-safety check: same wall time, different UTC instant

let alice: Viewer; // owns tasks
let bob: Viewer; // workspace member, used for the membership-revoked delivery test
let workspaceId: string;

const quick = (viewer: Viewer, input: string, context = "personal") =>
  tasks.createTaskFromQuickAdd(viewer, { input, clientMutationId: randomUUID(), context, projectId: null, view: null });

const mentionNotificationsFor = (userId: string, taskId: string) => db.notification.findMany({ where: { recipientId: userId, type: "TASK_DUE_SOON", entityId: taskId } });

suite("reminders & delivery engine (integration)", () => {
  beforeAll(async () => {
    const [a, b] = await Promise.all([f.makeUser("alice"), f.makeUser("bob")]);
    const ws = await f.makeWorkspace(a.id, [{ userId: b.id, role: "MEMBER" }]);
    workspaceId = ws.id;
    [alice, bob] = await Promise.all([f.viewerFor(a.id), f.viewerFor(b.id)]);
  });

  afterAll(() => f.cleanup());

  describe("setting & removing", () => {
    it("sets an absolute reminder, timezone-safe (same wall time, different UTC instant per timezone)", async () => {
      const { id: taskId } = await quick(alice, "Remind me absolutely");
      const tehranViewer = { ...alice, user: { ...alice.user, timezone: TZ } };
      const nyViewer = { ...alice, user: { ...alice.user, timezone: OTHER_TZ } };
      const remindOn = addDays(todayIn(TZ), 3);

      const inTehran = await reminders.setReminder(tehranViewer, { kind: "absolute", taskId, remindOn, remindTime: 9 * 60 });
      const expectedTehran = zonedToUtc(remindOn, 9 * 60, TZ).toISOString();
      expect(inTehran.remindAt).toBe(expectedTehran);

      const inNy = await reminders.setReminder(nyViewer, { kind: "absolute", taskId, remindOn, remindTime: 9 * 60 });
      const expectedNy = zonedToUtc(remindOn, 9 * 60, OTHER_TZ).toISOString();
      expect(inNy.remindAt).toBe(expectedNy);
      expect(inNy.remindAt).not.toBe(inTehran.remindAt); // same local 09:00, different instant
    });

    it("resolves a relative-to-due reminder against the task's current due date", async () => {
      const { id: taskId } = await quick(alice, "Due soon");
      const dueOn = addDays(todayIn(TZ), 5);
      await db.task.update({ where: { id: taskId }, data: { dueOn: toDbDate(dueOn), isAllDay: true } });

      const result = await reminders.setReminder(alice, { kind: "relativeToDue", taskId, daysBeforeDue: 2, remindTime: 8 * 60 });
      const expected = zonedToUtc(addDays(dueOn, -2), 8 * 60, alice.user.timezone).toISOString();
      expect(result.remindAt).toBe(expected);
    });

    it("refuses a relative reminder when the task has no due date", async () => {
      const { id: taskId } = await quick(alice, "No due date yet");
      await expect(reminders.setReminder(alice, { kind: "relativeToDue", taskId, daysBeforeDue: 1, remindTime: 540 })).rejects.toThrow("reminderNeedsDueDate");
    });

    it("is self-service and visibility-gated, like watching — not edit-gated, but never for an invisible task", async () => {
      const { id: taskId } = await quick(alice, "Shared via assignment", workspaceId);
      await tasks.setTaskAssignees(alice, taskId, [bob.user.id]); // bob can see it (assignee) though not the owner
      const remindOn = addDays(todayIn(TZ), 1);
      await expect(reminders.setReminder(bob, { kind: "absolute", taskId, remindOn, remindTime: 600 })).resolves.toBeDefined();
      expect(await getMyReminder(bob, taskId)).not.toBeNull();
      expect(await getMyReminder(alice, taskId)).toBeNull(); // each user's reminder is their own

      const { id: privateTaskId } = await quick(alice, "Alice's own errand");
      await expect(reminders.setReminder(bob, { kind: "absolute", taskId: privateTaskId, remindOn, remindTime: 600 })).rejects.toThrow(NOT_FOUND);
    });

    it("editing replaces the reminder (one per task per user) and records reminder_created vs reminder_updated", async () => {
      const { id: taskId } = await quick(alice, "Editable reminder");
      const day1 = addDays(todayIn(TZ), 1);
      const day2 = addDays(todayIn(TZ), 2);
      await reminders.setReminder(alice, { kind: "absolute", taskId, remindOn: day1, remindTime: 480 });
      expect(await db.activity.count({ where: { entityId: taskId, action: "reminder_created" } })).toBe(1);

      await reminders.setReminder(alice, { kind: "absolute", taskId, remindOn: day2, remindTime: 600 });
      expect(await db.reminder.count({ where: { taskId, userId: alice.user.id } })).toBe(1); // replaced, not duplicated
      expect(await db.activity.count({ where: { entityId: taskId, action: "reminder_updated" } })).toBe(1);

      const current = await getMyReminder(alice, taskId);
      expect(current?.remindAt).toBe(zonedToUtc(day2, 600, alice.user.timezone).toISOString());
    });

    it("removes a reminder, recording activity only when one existed", async () => {
      const { id: taskId } = await quick(alice, "Removable");
      await reminders.removeReminder(alice, taskId); // no-op, nothing to remove
      expect(await db.activity.count({ where: { entityId: taskId, action: "reminder_removed" } })).toBe(0);

      await reminders.setReminder(alice, { kind: "absolute", taskId, remindOn: addDays(todayIn(TZ), 1), remindTime: 540 });
      await reminders.removeReminder(alice, taskId);
      expect(await getMyReminder(alice, taskId)).toBeNull();
      expect(await db.activity.count({ where: { entityId: taskId, action: "reminder_removed" } })).toBe(1);
    });
  });

  describe("due-date interaction policy", () => {
    it("does not re-float an already-set reminder when the due date later changes", async () => {
      const { id: taskId } = await quick(alice, "Fixed-time reminder", workspaceId);
      const originalDue = addDays(todayIn(TZ), 2);
      await db.task.update({ where: { id: taskId }, data: { dueOn: toDbDate(originalDue), isAllDay: true } });
      await reminders.setReminder(alice, { kind: "relativeToDue", taskId, daysBeforeDue: 0, remindTime: 540 });
      const before = await getMyReminder(alice, taskId);

      await tasks.updateTask(alice, { taskId, expectedVersion: 1, dueOn: addDays(originalDue, 10) });
      const after = await getMyReminder(alice, taskId);
      expect(after?.remindAt).toBe(before?.remindAt); // untouched by the due-date change
    });

    it("clears pending reminders when the task is completed, and does not restore them on reopen", async () => {
      const { id: taskId } = await quick(alice, "Completed with a reminder");
      await reminders.setReminder(alice, { kind: "absolute", taskId, remindOn: addDays(todayIn(TZ), 1), remindTime: 540 });
      await tasks.setTaskCompletion(alice, taskId, true);
      expect(await getMyReminder(alice, taskId)).toBeNull();

      await tasks.setTaskCompletion(alice, taskId, false); // reopen
      expect(await getMyReminder(alice, taskId)).toBeNull(); // still gone — not resurrected
    });

    it("keeps a reminder through soft-delete and restore (short undo window, unlike completion)", async () => {
      const { id: taskId } = await quick(alice, "Soft-deleted with a reminder");
      await reminders.setReminder(alice, { kind: "absolute", taskId, remindOn: addDays(todayIn(TZ), 1), remindTime: 540 });
      await tasks.softDeleteTask(alice, taskId);
      expect(await db.reminder.count({ where: { taskId } })).toBe(1); // kept, just not delivered while deleted
      await tasks.restoreTask(alice, taskId);
      expect(await getMyReminder(alice, taskId)).not.toBeNull();
    });
  });

  describe("delivery engine", () => {
    async function makeDueReminder(label: string) {
      const { id: taskId } = await quick(alice, label, workspaceId);
      const past = new Date(Date.now() - 60_000);
      const row = await db.reminder.create({ data: { taskId, userId: alice.user.id, remindAt: past } });
      return { taskId, reminderId: row.id };
    }

    it("delivers exactly one notification per due reminder and marks it delivered", async () => {
      const { taskId, reminderId } = await makeDueReminder("Due now");
      const result = await deliverDueReminders();
      expect(result.delivered).toBeGreaterThanOrEqual(1);
      const row = await db.reminder.findUniqueOrThrow({ where: { id: reminderId } });
      expect(row.deliveredAt).not.toBeNull();
      expect(await mentionNotificationsFor(alice.user.id, taskId)).toHaveLength(1);
    });

    it("is idempotent: running it again does not re-notify an already-delivered reminder", async () => {
      const { taskId } = await makeDueReminder("Already delivered");
      await deliverDueReminders();
      await deliverDueReminders();
      await deliverDueReminders();
      expect(await mentionNotificationsFor(alice.user.id, taskId)).toHaveLength(1);
    });

    it("never delivers for a completed, cancelled, or soft-deleted task", async () => {
      const done = await makeDueReminder("Completed task reminder");
      await tasks.setTaskCompletion(alice, done.taskId, true);
      // setTaskCompletion already clears undelivered reminders (tested separately above); recreate
      // one directly, bypassing the service, to isolate the *engine's own* live-status filter.
      await db.reminder.create({ data: { taskId: done.taskId, userId: alice.user.id, remindAt: new Date(Date.now() - 60_000) } });

      const cancelled = await makeDueReminder("Cancelled task reminder");
      await tasks.updateTask(alice, { taskId: cancelled.taskId, expectedVersion: 1, status: "CANCELLED" });

      const deleted = await makeDueReminder("Deleted task reminder");
      await tasks.softDeleteTask(alice, deleted.taskId);

      await deliverDueReminders();
      expect(await mentionNotificationsFor(alice.user.id, done.taskId)).toHaveLength(0);
      expect(await mentionNotificationsFor(alice.user.id, cancelled.taskId)).toHaveLength(0);
      expect(await mentionNotificationsFor(alice.user.id, deleted.taskId)).toHaveLength(0);
    });

    it("re-delivers after an edit resets it (fresh generation, fresh dedupe key)", async () => {
      const { taskId, reminderId } = await makeDueReminder("Edited after delivery");
      await deliverDueReminders();
      expect(await mentionNotificationsFor(alice.user.id, taskId)).toHaveLength(1);

      await reminders.setReminder(alice, { kind: "absolute", taskId, remindOn: todayIn(TZ), remindTime: localMinutes(new Date(Date.now() - 60_000), TZ) });
      const row = await db.reminder.findUniqueOrThrow({ where: { id: reminderId } });
      expect(row.deliveredAt).toBeNull(); // live again

      await deliverDueReminders();
      expect(await mentionNotificationsFor(alice.user.id, taskId)).toHaveLength(2);
    });

    it("skips (marks delivered, never notifies) a recipient who is no longer an active workspace member", async () => {
      const [c] = await Promise.all([f.makeUser("carol")]);
      await db.membership.create({ data: { workspaceId, userId: c.id, role: "MEMBER" } });
      const carol = await f.viewerFor(c.id);
      const { id: taskId } = await quick(alice, "Carol's reminder", workspaceId);
      const row = await db.reminder.create({ data: { taskId, userId: carol.user.id, remindAt: new Date(Date.now() - 60_000) } });

      await db.membership.updateMany({ where: { workspaceId, userId: c.id }, data: { status: "DEACTIVATED" } });
      const result = await deliverDueReminders();
      expect(result.skippedInaccessible).toBeGreaterThanOrEqual(1);
      expect(await mentionNotificationsFor(carol.user.id, taskId)).toHaveLength(0);
      expect((await db.reminder.findUniqueOrThrow({ where: { id: row.id } })).deliveredAt).not.toBeNull();
    });

    it("prevents duplicate delivery under concurrency: two simultaneous runs still notify exactly once", async () => {
      const { taskId } = await makeDueReminder("Race");
      await Promise.all([deliverDueReminders(), deliverDueReminders()]);
      expect(await mentionNotificationsFor(alice.user.id, taskId)).toHaveLength(1);
    });
  });
});
