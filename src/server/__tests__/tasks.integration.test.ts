import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NotificationType } from "@/generated/prisma/client";
import { addDays, fromDbDate, todayIn, toDbDate } from "@/lib/time";
import { CONFLICT, NOT_FOUND } from "@/lib/action-result";
import { db } from "@/server/db";
import type { Viewer } from "@/server/context";
import * as labels from "@/features/labels/server/service";
import { findVisibleTask } from "@/features/tasks/server/access";
import { getPlannerTasks, searchDependencyCandidates } from "@/features/tasks/server/queries";
import * as tasks from "@/features/tasks/server/service";

// Runs the real services against the local database (see .env). Skipped without DATABASE_URL.
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const run = randomUUID().slice(0, 8);
const TZ = "Asia/Tehran";
const userIds: string[] = [];
const workspaceIds: string[] = [];

async function makeUser(label: string) {
  const u = await db.user.create({
    data: { email: `${label}-${run}@test.local`, name: `${label} ${run}`, passwordHash: "x", timezone: TZ },
  });
  userIds.push(u.id);
  return u;
}

/** Mirrors getViewer() without cookies. */
async function viewerFor(userId: string): Promise<Viewer> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, name: true, avatarUrl: true, timezone: true, locale: true, theme: true, weekStartsOn: true, activeWorkspaceId: true, onboardedAt: true },
  });
  const memberships = await db.membership.findMany({
    where: { userId, status: "ACTIVE" },
    select: { role: true, customRole: { select: { capabilities: true } }, workspace: { select: { id: true, name: true, slug: true, iconUrl: true, timezone: true } } },
  });
  const workspaces = memberships.map((m) => ({
    ...m.workspace,
    actor: { userId, workspaceId: m.workspace.id, role: m.role, customCapabilities: m.customRole?.capabilities ?? null, active: true },
  }));
  const { onboardedAt, ...rest } = user;
  return { user: { ...rest, isOnboarded: onboardedAt !== null }, workspaces, activeWorkspace: workspaces.find((w) => w.id === user.activeWorkspaceId) ?? null };
}

const quick = (viewer: Viewer, input: string, context = "personal", extra: Partial<{ projectId: string; view: string }> = {}) =>
  tasks.createTaskFromQuickAdd(viewer, { input, clientMutationId: randomUUID(), context, projectId: extra.projectId ?? null, view: extra.view ?? null });

let alice: Viewer;
let bob: Viewer;
let guest: Viewer;
let outsider: Viewer;
let workspaceId: string;
let sharedProjectId: string;
let privateProjectId: string;

suite("task services (integration)", () => {
  beforeAll(async () => {
    const [a, b, g, o] = await Promise.all([makeUser("alice"), makeUser("bob"), makeUser("guest"), makeUser("outsider")]);
    const ws = await db.workspace.create({
      data: {
        name: `WS ${run}`,
        slug: `ws-${run}`,
        createdById: a.id,
        memberships: { create: [{ userId: a.id, role: "OWNER" }, { userId: b.id, role: "MEMBER" }, { userId: g.id, role: "GUEST" }] },
      },
    });
    workspaceId = ws.id;
    workspaceIds.push(ws.id);
    const shared = await db.project.create({
      data: { scope: "WORKSPACE", workspaceId, ownerId: a.id, createdById: a.id, name: "Shared", visibility: "WORKSPACE", members: { create: { userId: a.id, role: "LEAD" } } },
    });
    const priv = await db.project.create({
      data: { scope: "WORKSPACE", workspaceId, ownerId: a.id, createdById: a.id, name: "Secret", visibility: "PRIVATE", members: { create: { userId: a.id, role: "LEAD" } } },
    });
    sharedProjectId = shared.id;
    privateProjectId = priv.id;
    [alice, bob, guest, outsider] = await Promise.all([viewerFor(a.id), viewerFor(b.id), viewerFor(g.id), viewerFor(o.id)]);
  });

  afterAll(async () => {
    await db.task.deleteMany({ where: { OR: [{ ownerId: { in: userIds } }, { workspaceId: { in: workspaceIds } }] } });
    await db.recurrenceSeries.deleteMany({ where: { ownerId: { in: userIds } } });
    await db.activity.deleteMany({ where: { actorId: { in: userIds } } });
    await db.auditEvent.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
    await db.label.deleteMany({ where: { OR: [{ ownerId: { in: userIds } }, { workspaceId: { in: workspaceIds } }] } }); // onDelete: Restrict on owner
    await db.project.deleteMany({ where: { ownerId: { in: userIds } } });
    await db.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  });

  describe("visibility", () => {
    it("keeps personal tasks private", async () => {
      const { id } = await quick(alice, "Alice private errand");
      expect(await findVisibleTask(alice, id)).not.toBeNull();
      expect(await findVisibleTask(bob, id)).toBeNull();
      expect(await findVisibleTask(outsider, id)).toBeNull();
    });

    it("shows workspace-visible project tasks to members but not guests or outsiders", async () => {
      const { id } = await quick(alice, "Shared project work", "personal", { projectId: sharedProjectId });
      const row = await db.task.findUniqueOrThrow({ where: { id } });
      expect(row.scope).toBe("WORKSPACE"); // the project decides the scope, not the client context
      expect(row.workspaceId).toBe(workspaceId);
      expect(await findVisibleTask(bob, id)).not.toBeNull();
      expect(await findVisibleTask(guest, id)).toBeNull();
      expect(await findVisibleTask(outsider, id)).toBeNull();
    });

    it("hides private project tasks from non-members", async () => {
      const { id } = await quick(alice, "Secret work", "personal", { projectId: privateProjectId });
      expect(await findVisibleTask(bob, id)).toBeNull();
    });

    it("refuses to create tasks in a workspace the user is not in", async () => {
      await expect(quick(outsider, "Sneaky", workspaceId)).rejects.toThrow(tasks.DomainError);
    });

    it("refuses to add tasks to a project the user cannot see", async () => {
      await expect(quick(bob, "Into the secret", "personal", { projectId: privateProjectId })).rejects.toThrow(NOT_FOUND);
    });

    it("lets a non-owner neither edit nor delete someone else's task", async () => {
      const { id } = await quick(alice, "Alice only");
      await expect(tasks.setTaskCompletion(bob, id, true)).rejects.toThrow(NOT_FOUND);
      await expect(tasks.softDeleteTask(bob, id)).rejects.toThrow(NOT_FOUND);
    });
  });

  describe("quick add & idempotency", () => {
    it("parses the input in the user's timezone", async () => {
      const { id } = await quick(alice, "Pay rent tomorrow 9am !high");
      const t = await db.task.findUniqueOrThrow({ where: { id } });
      const tomorrow = addDays(todayIn(TZ), 1);
      expect(t.title).toBe("Pay rent");
      expect(t.priority).toBe("HIGH");
      expect(t.isAllDay).toBe(false);
      expect(fromDbDate(t.dueOn!)).toBe(tomorrow);
      expect(t.dueAt!.toISOString()).toBe(new Date(`${tomorrow}T05:30:00.000Z`).toISOString()); // 09:00 +03:30
    });

    it("collapses a double submit into one task", async () => {
      const clientMutationId = randomUUID();
      const input = { input: "Only once", clientMutationId, context: "personal", projectId: null, view: null };
      const [a, b] = await Promise.all([tasks.createTaskFromQuickAdd(alice, input), tasks.createTaskFromQuickAdd(alice, input)]);
      expect(a.id).toBe(b.id);
      expect(await db.task.count({ where: { clientMutationId } })).toBe(1);
    });

    it("defaults Today-view captures to today", async () => {
      const { id } = await quick(alice, "Something now", "personal", { view: "today" });
      const t = await db.task.findUniqueOrThrow({ where: { id } });
      expect(fromDbDate(t.dueOn!)).toBe(todayIn(TZ));
    });
  });

  describe("unicode content", () => {
    it("stores and returns Persian text exactly as entered", async () => {
      const title = "بررسی گزارش‌های فصلی — نسخهٔ ۲";
      const { id } = await quick(alice, title);
      const row = await db.task.findUniqueOrThrow({ where: { id } });
      expect(row.title).toBe(title);
      expect(row.title.normalize("NFC")).toBe(title.normalize("NFC"));
      expect([...row.title]).toContain("‌");
    });
  });

  describe("planner views", () => {
    it("buckets tasks into inbox, today, overdue and upcoming", async () => {
      const today = todayIn(TZ);
      const inbox = await quick(alice, "Inbox thing");
      const due = await quick(alice, "Due today today");
      const later = await quick(alice, "Later next week");
      const late = await quick(alice, "Was due");
      await db.task.update({ where: { id: late.id }, data: { dueOn: toDbDate(addDays(today, -2)) } });

      const ids = async (view: Parameters<typeof getPlannerTasks>[1]) =>
        (await getPlannerTasks(alice, view, { kind: "personal" })).tasks.map((t) => t.id);
      expect(await ids("inbox")).toContain(inbox.id);
      expect(await ids("inbox")).not.toContain(due.id);
      expect(await ids("today")).toEqual(expect.arrayContaining([due.id, late.id]));
      expect(await ids("today")).not.toContain(later.id);
      expect(await ids("overdue")).toContain(late.id);
      expect(await ids("overdue")).not.toContain(due.id);
      expect(await ids("upcoming")).toContain(later.id);
    });

    it("never lists another user's tasks", async () => {
      const { id } = await quick(alice, "Mine alone today");
      const bobs = (await getPlannerTasks(bob, "all", { kind: "all" })).tasks.map((t) => t.id);
      expect(bobs).not.toContain(id);
    });
  });

  describe("recurrence", () => {
    it("generates exactly one next occurrence, even on re-completion or races", async () => {
      const { id } = await quick(alice, "Water plants today");
      await tasks.setTaskRecurrence(alice, id, "daily", "FIXED_SCHEDULE");

      const first = await tasks.setTaskCompletion(alice, id, true);
      expect(first.nextOccurrenceId).not.toBeNull();
      const next = await db.task.findUniqueOrThrow({ where: { id: first.nextOccurrenceId! } });
      expect(fromDbDate(next.occurrenceOn!)).toBe(addDays(todayIn(TZ), 1));
      expect(next.status).toBe("TODO");

      // Reopen and complete the old occurrence again: no second "tomorrow" task.
      await tasks.setTaskCompletion(alice, id, false);
      const again = await tasks.setTaskCompletion(alice, id, true);
      expect(again.nextOccurrenceId).toBeNull();
      expect(await db.task.count({ where: { seriesId: next.seriesId } })).toBe(2);

      // Two simultaneous completions of the latest occurrence still yield one successor.
      const results = await Promise.allSettled([tasks.setTaskCompletion(alice, next.id, true), tasks.setTaskCompletion(alice, next.id, true)]);
      expect(results.some((r) => r.status === "fulfilled")).toBe(true);
      expect(await db.task.count({ where: { seriesId: next.seriesId } })).toBe(3);
    });

    it("requires a due date to repeat", async () => {
      const { id } = await quick(alice, "Undated habit");
      await expect(tasks.setTaskRecurrence(alice, id, "weekly", "FIXED_SCHEDULE")).rejects.toThrow(tasks.DomainError);
    });
  });

  describe("concurrency & integrity", () => {
    it("rejects an update based on a stale version", async () => {
      const { id } = await quick(alice, "Contested");
      await tasks.updateTask(alice, { taskId: id, expectedVersion: 1, title: "First edit" });
      await expect(tasks.updateTask(alice, { taskId: id, expectedVersion: 1, title: "Stale edit" })).rejects.toThrow(CONFLICT);
      expect((await db.task.findUniqueOrThrow({ where: { id } })).title).toBe("First edit");
    });

    it("rejects circular dependencies", async () => {
      const a = await quick(alice, "Step A");
      const b = await quick(alice, "Step B");
      const c = await quick(alice, "Step C");
      await tasks.addDependency(alice, a.id, b.id);
      await tasks.addDependency(alice, b.id, c.id);
      await expect(tasks.addDependency(alice, c.id, a.id)).rejects.toThrow("dependencyCycle");
      await expect(tasks.addDependency(alice, a.id, a.id)).rejects.toThrow("dependencyCycle");
    });

    it("soft-deletes and restores, keeping the row", async () => {
      const { id } = await quick(alice, "Oops");
      await tasks.softDeleteTask(alice, id);
      expect(await findVisibleTask(alice, id)).toBeNull();
      expect(await db.task.findUnique({ where: { id } })).not.toBeNull();
      await tasks.restoreTask(alice, id);
      expect(await findVisibleTask(alice, id)).not.toBeNull();
    });

    it("enforces scope integrity in the database itself", async () => {
      await expect(
        db.task.create({ data: { scope: "PERSONAL", workspaceId, ownerId: alice.user.id, createdById: alice.user.id, title: "Invalid" } }),
      ).rejects.toThrow();
      await expect(
        db.task.create({ data: { scope: "WORKSPACE", workspaceId: null, ownerId: alice.user.id, createdById: alice.user.id, title: "Invalid" } }),
      ).rejects.toThrow();
    });
  });

  describe("Phase 3 batch 1: assignees", () => {
    it("lets a member with tasks.assign assign another active member", async () => {
      const { id } = await quick(alice, "Needs an owner", workspaceId);
      await tasks.setTaskAssignees(alice, id, [bob.user.id]);
      const row = await db.task.findUniqueOrThrow({ where: { id }, include: { assignees: true } });
      expect(row.assignees.map((a) => a.userId)).toEqual([bob.user.id]);
      expect(row.assignees[0]!.assignedById).toBe(alice.user.id);
      const activity = await db.activity.findFirst({ where: { entityId: id, action: "assignees_changed" } });
      expect(activity?.data).toMatchObject({ added: [bob.user.id], removed: [] });
    });

    it("diffs added and removed on a second call", async () => {
      const { id } = await quick(alice, "Reassign me", workspaceId);
      await tasks.setTaskAssignees(alice, id, [bob.user.id]);
      await tasks.setTaskAssignees(alice, id, [guest.user.id]);
      const row = await db.task.findUniqueOrThrow({ where: { id }, include: { assignees: true } });
      expect(row.assignees.map((a) => a.userId)).toEqual([guest.user.id]);
    });

    it("refuses to assign someone outside the workspace", async () => {
      const { id } = await quick(alice, "No outsiders", workspaceId);
      await expect(tasks.setTaskAssignees(alice, id, [outsider.user.id])).rejects.toThrow(NOT_FOUND);
    });

    it("refuses assignees on a personal task", async () => {
      const { id } = await quick(alice, "Just me");
      await expect(tasks.setTaskAssignees(alice, id, [bob.user.id])).rejects.toThrow(NOT_FOUND);
    });

    it("refuses a member without tasks.assign (guest)", async () => {
      const { id } = await quick(alice, "Guests can't delegate", workspaceId);
      await expect(tasks.setTaskAssignees(guest, id, [bob.user.id])).rejects.toThrow(NOT_FOUND);
    });
  });

  describe("Phase 3 batch 1: watchers", () => {
    it("is self-service: anyone who can see the task may follow or unfollow it", async () => {
      const { id } = await quick(alice, "Shared watch target", "personal", { projectId: sharedProjectId });
      await tasks.watchTask(bob, id);
      expect((await db.task.findUniqueOrThrow({ where: { id }, include: { watchers: true } })).watchers.map((w) => w.userId)).toEqual([bob.user.id]);
      await tasks.unwatchTask(bob, id);
      expect((await db.task.findUniqueOrThrow({ where: { id }, include: { watchers: true } })).watchers).toHaveLength(0);
    });

    it("refuses to watch a task the viewer cannot see", async () => {
      const { id } = await quick(alice, "Private from outsider");
      await expect(tasks.watchTask(outsider, id)).rejects.toThrow(NOT_FOUND);
    });

    it("is idempotent", async () => {
      const { id } = await quick(alice, "Watch twice");
      await tasks.watchTask(alice, id);
      await tasks.watchTask(alice, id); // no duplicate, no error
      expect((await db.task.findUniqueOrThrow({ where: { id }, include: { watchers: true } })).watchers).toHaveLength(1);
    });
  });

  describe("Phase 3 batch 1: subtasks", () => {
    it("creates a subtask through the shared task-creation core", async () => {
      const parent = await quick(alice, "Parent task");
      const { id: subId } = await tasks.createSubtask(alice, parent.id, "First step");
      const sub = await db.task.findUniqueOrThrow({ where: { id: subId } });
      expect(sub.parentId).toBe(parent.id);
      expect(sub.ownerId).toBe(alice.user.id);
      const parentActivity = await db.activity.findFirst({ where: { entityId: parent.id, action: "subtask_created" } });
      expect(parentActivity?.data).toMatchObject({ subtaskId: subId });
    });

    it("rejects a subtask of a subtask (one level only)", async () => {
      const parent = await quick(alice, "Top level");
      const { id: subId } = await tasks.createSubtask(alice, parent.id, "Child");
      await expect(tasks.createSubtask(alice, subId, "Grandchild")).rejects.toThrow("subtaskTooDeep");
    });

    it("completing and soft-deleting a subtask behaves like any other task", async () => {
      const parent = await quick(alice, "Has a subtask");
      const { id: subId } = await tasks.createSubtask(alice, parent.id, "Do this");
      await tasks.setTaskCompletion(alice, subId, true);
      expect((await db.task.findUniqueOrThrow({ where: { id: subId } })).status).toBe("DONE");
      await tasks.softDeleteTask(alice, subId);
      expect(await findVisibleTask(alice, subId)).toBeNull();
    });

    it("refuses a subtask on a task the viewer cannot edit", async () => {
      const { id } = await quick(alice, "Alice's only");
      await expect(tasks.createSubtask(bob, id, "Sneaky")).rejects.toThrow(NOT_FOUND);
    });
  });

  describe("Phase 3 batch 1: labels", () => {
    it("creates a workspace label and applies it to a task", async () => {
      const bug = await labels.createLabel(alice, workspaceId, `Bug-${run}`, "red");
      const { id } = await quick(alice, "Buggy", workspaceId);
      await tasks.setTaskLabels(alice, id, [bug.id]);
      const row = await db.task.findUniqueOrThrow({ where: { id }, include: { labels: true } });
      expect(row.labels.map((l) => l.labelId)).toEqual([bug.id]);
      const activity = await db.activity.findFirst({ where: { entityId: id, action: "labels_changed" } });
      expect(activity?.data).toMatchObject({ added: [bug.id], removed: [] });
    });

    it("rejects a duplicate label name in the same scope (case-insensitive)", async () => {
      await labels.createLabel(alice, workspaceId, `Dup-${run}`, "blue");
      await expect(labels.createLabel(bob, workspaceId, `dup-${run}`, "green")).rejects.toThrow("labelNameTaken");
    });

    it("archived labels can no longer be applied to a task", async () => {
      const l = await labels.createLabel(alice, workspaceId, `Retired-${run}`, "slate");
      await labels.archiveLabel(alice, l.id);
      const { id } = await quick(alice, "Can't tag this", workspaceId);
      await expect(tasks.setTaskLabels(alice, id, [l.id])).rejects.toThrow(NOT_FOUND);
    });

    it("refuses a personal label on a workspace task and vice versa", async () => {
      const personalLabel = await labels.createLabel(alice, "personal", `Mine-${run}`, "yellow");
      const { id: wsTask } = await quick(alice, "Workspace task", workspaceId);
      await expect(tasks.setTaskLabels(alice, wsTask, [personalLabel.id])).rejects.toThrow(NOT_FOUND);

      const wsLabel = await labels.createLabel(alice, workspaceId, `Shared-${run}`, "peach");
      const { id: personalTask } = await quick(alice, "Personal task");
      await expect(tasks.setTaskLabels(alice, personalTask, [wsLabel.id])).rejects.toThrow(NOT_FOUND);
    });

    it("only the creator or a workspace manager can rename or archive a label", async () => {
      const l = await labels.createLabel(alice, workspaceId, `Owned-${run}`, "blue");
      await expect(labels.renameLabel(bob, l.id, "Hijacked", "red")).rejects.toThrow(NOT_FOUND);
      await labels.renameLabel(alice, l.id, "Renamed", "red"); // creator (and owner) may
    });
  });

  describe("Phase 3 batch 1: delegated planner view", () => {
    it("shows a task in the owner's delegated view once assigned away, and in the assignee's normal view", async () => {
      const { id } = await quick(alice, "Handed off", workspaceId);
      await tasks.setTaskAssignees(alice, id, [bob.user.id]);

      const aliceAll = (await getPlannerTasks(alice, "all", { kind: "all" })).tasks.map((t) => t.id);
      expect(aliceAll).not.toContain(id); // no longer "mine" once delegated away

      const aliceDelegated = (await getPlannerTasks(alice, "delegated", { kind: "all" })).tasks.map((t) => t.id);
      expect(aliceDelegated).toContain(id);

      const bobAll = (await getPlannerTasks(bob, "all", { kind: "all" })).tasks.map((t) => t.id);
      expect(bobAll).toContain(id); // assignee sees it normally
      const bobDelegated = (await getPlannerTasks(bob, "delegated", { kind: "all" })).tasks.map((t) => t.id);
      expect(bobDelegated).not.toContain(id); // bob doesn't own it
    });

    it("leaves the owner's view alone when self-assigned", async () => {
      const { id } = await quick(alice, "Still mine", workspaceId);
      await tasks.setTaskAssignees(alice, id, [alice.user.id]);
      const aliceAll = (await getPlannerTasks(alice, "all", { kind: "all" })).tasks.map((t) => t.id);
      expect(aliceAll).toContain(id);
      const aliceDelegated = (await getPlannerTasks(alice, "delegated", { kind: "all" })).tasks.map((t) => t.id);
      expect(aliceDelegated).not.toContain(id);
    });
  });

  describe("Phase 3 batch 2: dependency management", () => {
    it("adds then removes a dependency, recording activity for both", async () => {
      const a = await quick(alice, "Dep A");
      const b = await quick(alice, "Dep B");
      await tasks.addDependency(alice, a.id, b.id);
      let row = await db.task.findUniqueOrThrow({ where: { id: b.id }, include: { blockedBy: true } });
      expect(row.blockedBy.map((d) => d.blockingTaskId)).toEqual([a.id]);

      await tasks.removeDependency(alice, a.id, b.id);
      row = await db.task.findUniqueOrThrow({ where: { id: b.id }, include: { blockedBy: true } });
      expect(row.blockedBy).toHaveLength(0);
      const removedActivity = await db.activity.findFirst({ where: { entityId: b.id, action: "dependency_removed" } });
      expect(removedActivity?.data).toMatchObject({ blockingTaskId: a.id });
    });

    it("is a no-op (no activity recorded) when removing a dependency that was never created", async () => {
      const a = await quick(alice, "No-op A");
      const b = await quick(alice, "No-op B");
      await tasks.removeDependency(alice, a.id, b.id);
      expect(await db.activity.findFirst({ where: { entityId: b.id, action: "dependency_removed" } })).toBeNull();
    });

    it("refuses to add or remove a dependency without edit rights on the blocked task", async () => {
      const a = await quick(alice, "Alice-only A");
      const b = await quick(alice, "Alice-only B");
      await expect(tasks.addDependency(bob, a.id, b.id)).rejects.toThrow(NOT_FOUND);
      await tasks.addDependency(alice, a.id, b.id);
      await expect(tasks.removeDependency(bob, a.id, b.id)).rejects.toThrow(NOT_FOUND);
    });

    it("lets a member see a shared-project task but refuses dependency mutation without edit rights on it", async () => {
      const a = await quick(alice, "Shared dep A", "personal", { projectId: sharedProjectId });
      const b = await quick(alice, "Shared dep B", "personal", { projectId: sharedProjectId });
      expect(await findVisibleTask(bob, b.id)).not.toBeNull(); // visible: workspace-visible project
      await expect(tasks.addDependency(bob, a.id, b.id)).rejects.toThrow(NOT_FOUND); // not editable: no role, not owner/creator/assignee
    });

    it("searches dependency candidates within the same scope only, excluding the task itself", async () => {
      const target = await quick(alice, "Needle candidate", workspaceId);
      const anchor = await quick(alice, "Anchor task", workspaceId);
      const personalDecoy = await quick(alice, "Needle candidate but personal");
      const results = (await searchDependencyCandidates(alice, anchor.id, "Needle")).map((r) => r.id);
      expect(results).toContain(target.id);
      expect(results).not.toContain(anchor.id);
      expect(results).not.toContain(personalDecoy.id);
    });
  });

  describe("Phase 3 batch 3: watcher-policy notifications & activity hardening", () => {
    const notificationsFor = (userId: string, type: NotificationType, taskId: string) => db.notification.findMany({ where: { recipientId: userId, type, entityId: taskId } });

    it("notifies owner/assignees/watchers on a status change, deduping a recipient who is both assignee and watcher, never the actor", async () => {
      const { id } = await quick(alice, "Status watched", workspaceId);
      await tasks.setTaskAssignees(alice, id, [bob.user.id, guest.user.id]); // assignment grants visibility to both
      await tasks.watchTask(bob, id); // bob is now both assignee AND watcher — must not double-notify

      const task = await db.task.findUniqueOrThrow({ where: { id } });
      await tasks.updateTask(alice, { taskId: id, expectedVersion: task.version, status: "IN_PROGRESS" });

      expect(await notificationsFor(bob.user.id, "TASK_STATUS_CHANGED", id)).toHaveLength(1); // not 2
      expect(await notificationsFor(guest.user.id, "TASK_STATUS_CHANGED", id)).toHaveLength(1);
      expect(await notificationsFor(alice.user.id, "TASK_STATUS_CHANGED", id)).toHaveLength(0); // actor excluded
      expect(await db.activity.findFirst({ where: { entityId: id, action: "status_changed" } })).toMatchObject({ data: { from: "TODO", to: "IN_PROGRESS" } });
    });

    it("notifies on a due-date change (schedule_changed), separately from plain field edits which notify no one", async () => {
      const due = await quick(alice, "Due date watched", workspaceId);
      await tasks.setTaskAssignees(alice, due.id, [bob.user.id]); // grants bob visibility so he can watch it too
      await tasks.watchTask(bob, due.id);
      const row1 = await db.task.findUniqueOrThrow({ where: { id: due.id } });
      await tasks.updateTask(alice, { taskId: due.id, expectedVersion: row1.version, dueOn: addDays(todayIn(TZ), 3) });
      expect(await notificationsFor(bob.user.id, "TASK_DUE_DATE_CHANGED", due.id)).toHaveLength(1);
      expect(await db.activity.findFirst({ where: { entityId: due.id, action: "schedule_changed" } })).not.toBeNull();

      const plain = await quick(alice, "Plain edit watched", workspaceId);
      await tasks.setTaskAssignees(alice, plain.id, [bob.user.id]);
      await tasks.watchTask(bob, plain.id);
      const row2 = await db.task.findUniqueOrThrow({ where: { id: plain.id } });
      await tasks.updateTask(alice, { taskId: plain.id, expectedVersion: row2.version, title: "Renamed", priority: "HIGH" });
      expect(await notificationsFor(bob.user.id, "TASK_STATUS_CHANGED", plain.id)).toHaveLength(0);
      expect(await notificationsFor(bob.user.id, "TASK_DUE_DATE_CHANGED", plain.id)).toHaveLength(0);
      const plainActivity = await db.activity.findFirst({ where: { entityId: plain.id, action: "updated" } });
      expect(plainActivity?.data).toMatchObject({ fields: expect.arrayContaining(["title", "priority"]) });
    });

    it("notifies watcher-policy recipients on completion and on reopen", async () => {
      const { id } = await quick(alice, "Completion watched", workspaceId);
      await tasks.setTaskAssignees(alice, id, [bob.user.id]);
      await tasks.watchTask(bob, id);
      await tasks.setTaskCompletion(alice, id, true);
      expect(await notificationsFor(bob.user.id, "TASK_STATUS_CHANGED", id)).toHaveLength(1);
      await tasks.setTaskCompletion(alice, id, false);
      expect(await notificationsFor(bob.user.id, "TASK_STATUS_CHANGED", id)).toHaveLength(2); // a second, distinct event
    });

    it("notifies a blocked task's stakeholders once its last open blocker completes, not before", async () => {
      const blockerA = await quick(alice, "Blocker A", workspaceId);
      const blockerB = await quick(alice, "Blocker B", workspaceId);
      const blocked = await quick(alice, "Blocked task", workspaceId);
      await tasks.setTaskAssignees(alice, blocked.id, [bob.user.id]);
      await tasks.addDependency(alice, blockerA.id, blocked.id);
      await tasks.addDependency(alice, blockerB.id, blocked.id);

      await tasks.setTaskCompletion(alice, blockerA.id, true);
      expect(await notificationsFor(bob.user.id, "TASK_UNBLOCKED", blocked.id)).toHaveLength(0); // blockerB still open

      await tasks.setTaskCompletion(alice, blockerB.id, true);
      expect(await notificationsFor(bob.user.id, "TASK_UNBLOCKED", blocked.id)).toHaveLength(1);
    });
  });
});
