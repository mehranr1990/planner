import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, fromDbDate, todayIn, toDbDate } from "@/lib/time";
import { CONFLICT, NOT_FOUND } from "@/lib/action-result";
import { db } from "@/server/db";
import type { Viewer } from "@/server/context";
import { findVisibleTask } from "@/features/tasks/server/access";
import { getPlannerTasks } from "@/features/tasks/server/queries";
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
});
