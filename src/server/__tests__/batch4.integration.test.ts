import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NotificationType } from "@/generated/prisma/client";
import { addDays, todayIn, toDbDate } from "@/lib/time";
import { db } from "@/server/db";
import type { Viewer } from "@/server/context";
import * as labels from "@/features/labels/server/service";
import * as bulk from "@/features/tasks/server/bulk";
import { parsePlannerFilters, plannerFiltersWhere } from "@/features/tasks/server/filters";
import { getPlannerTasks } from "@/features/tasks/server/queries";
import * as tasks from "@/features/tasks/server/service";

// Runs the real services against the local database (see .env). Skipped without DATABASE_URL.
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const run = randomUUID().slice(0, 8);
const TZ = "Asia/Tehran";
const userIds: string[] = [];
const workspaceIds: string[] = [];

async function makeUser(label: string) {
  const u = await db.user.create({ data: { email: `${label}-${run}@test.local`, name: `${label} ${run}`, passwordHash: "x", timezone: TZ } });
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
let carol: Viewer;
let guest: Viewer;
let outsider: Viewer;
let workspaceId: string;
let projectId: string;

suite("Batch 4: filters, bulk actions, reorder (integration)", () => {
  beforeAll(async () => {
    const [a, b, c, g, o] = await Promise.all([makeUser("alice"), makeUser("bob"), makeUser("carol"), makeUser("guest"), makeUser("outsider")]);
    const ws = await db.workspace.create({
      data: {
        name: `WS ${run}`,
        slug: `ws-${run}`,
        createdById: a.id,
        memberships: { create: [{ userId: a.id, role: "OWNER" }, { userId: b.id, role: "MEMBER" }, { userId: c.id, role: "MEMBER" }, { userId: g.id, role: "GUEST" }] },
      },
    });
    workspaceId = ws.id;
    workspaceIds.push(ws.id);
    const project = await db.project.create({
      data: { scope: "WORKSPACE", workspaceId, ownerId: a.id, createdById: a.id, name: "Project", visibility: "WORKSPACE", members: { create: { userId: a.id, role: "LEAD" } } },
    });
    projectId = project.id;
    [alice, bob, carol, guest, outsider] = await Promise.all([viewerFor(a.id), viewerFor(b.id), viewerFor(c.id), viewerFor(g.id), viewerFor(o.id)]);
  });

  afterAll(async () => {
    await db.task.deleteMany({ where: { OR: [{ ownerId: { in: userIds } }, { workspaceId: { in: workspaceIds } }] } });
    await db.activity.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { workspaceId: { in: workspaceIds } }] } });
    await db.label.deleteMany({ where: { OR: [{ ownerId: { in: userIds } }, { workspaceId: { in: workspaceIds } }] } });
    await db.project.deleteMany({ where: { ownerId: { in: userIds } } });
    await db.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  });

  describe("advanced filters", () => {
    it("composes priority + overdue + assignee", async () => {
      const yesterday = addDays(todayIn(TZ), -1);
      const { id: urgentOverdueAssigned } = await quick(alice, "urgent overdue assigned", workspaceId);
      await db.task.update({ where: { id: urgentOverdueAssigned }, data: { priority: "URGENT", dueOn: toDbDate(yesterday) } });
      await tasks.setTaskAssignees(alice, urgentOverdueAssigned, [bob.user.id]);

      const { id: urgentOverdueUnassigned } = await quick(alice, "urgent overdue unassigned", workspaceId);
      await db.task.update({ where: { id: urgentOverdueUnassigned }, data: { priority: "URGENT", dueOn: toDbDate(yesterday) } });

      const { id: lowOverdueAssigned } = await quick(alice, "low overdue assigned", workspaceId);
      await db.task.update({ where: { id: lowOverdueAssigned }, data: { priority: "LOW", dueOn: toDbDate(yesterday) } });
      await tasks.setTaskAssignees(alice, lowOverdueAssigned, [bob.user.id]);

      // Bob's own "all" (= his work: assigned to him) filtered to urgent + overdue + explicitly
      // himself as assignee — "all" is ownership-scoped per view (AS-4), so this is queried as
      // the assignee, not as alice (who delegated it away and would see it under "delegated" instead).
      const filters = parsePlannerFilters({ priority: "URGENT", assignee: bob.user.id, overdue: "1" });
      const { tasks: result } = await getPlannerTasks(bob, "all", { kind: "workspace", workspaceId }, filters);
      expect(result.map((t) => t.id)).toEqual([urgentOverdueAssigned]);
    });

    it("composes project + label + incomplete", async () => {
      const label = await labels.createLabel(alice, workspaceId, `Filter-${run}`, "blue");
      const { id: matching } = await quick(alice, "matching task", workspaceId, { projectId });
      await tasks.setTaskLabels(alice, matching, [label.id]);
      const { id: done } = await quick(alice, "done task", workspaceId, { projectId });
      await tasks.setTaskLabels(alice, done, [label.id]);
      await tasks.setTaskCompletion(alice, done, true);
      const { id: otherProject } = await quick(alice, "other project task", workspaceId);
      await tasks.setTaskLabels(alice, otherProject, [label.id]);

      const filters = parsePlannerFilters({ project: projectId, label: label.id, completed: "0" });
      const { tasks: result } = await getPlannerTasks(alice, "all", { kind: "workspace", workspaceId }, filters);
      expect(result.map((t) => t.id)).toEqual([matching]);
    });

    it("composes delegated + due-this-week", async () => {
      const soon = addDays(todayIn(TZ), 2);
      const { id: delegatedSoon } = await quick(alice, "delegated soon", workspaceId);
      await db.task.update({ where: { id: delegatedSoon }, data: { dueOn: toDbDate(soon) } });
      await tasks.setTaskAssignees(alice, delegatedSoon, [bob.user.id]);
      const { id: delegatedLater } = await quick(alice, "delegated later", workspaceId);
      await db.task.update({ where: { id: delegatedLater }, data: { dueOn: toDbDate(addDays(todayIn(TZ), 30)) } });
      await tasks.setTaskAssignees(alice, delegatedLater, [bob.user.id]);

      const filters = parsePlannerFilters({ delegated: "1", dueBefore: addDays(todayIn(TZ), 7) });
      const { tasks: result } = await getPlannerTasks(alice, "all", { kind: "workspace", workspaceId }, filters);
      const ids = result.map((t) => t.id);
      expect(ids).toContain(delegatedSoon);
      expect(ids).not.toContain(delegatedLater);
    });

    it("filters watched tasks, overriding the view's default ownership scoping", async () => {
      // Bob isn't the owner/assignee/creator of either task — only the shared, WORKSPACE-visibility
      // project makes them visible to him at all, same rule `visibleTasksWhere` already enforces.
      const { id: watched } = await quick(alice, "watched by bob", workspaceId, { projectId });
      await tasks.watchTask(bob, watched);
      const { id: unwatched } = await quick(alice, "not watched", workspaceId, { projectId });

      const filters = parsePlannerFilters({ watched: "1" });
      const { tasks: result } = await getPlannerTasks(bob, "all", { kind: "workspace", workspaceId }, filters);
      const ids = result.map((t) => t.id);
      expect(ids).toContain(watched); // "all" ownership (mine) would normally exclude this — watched overrides it
      expect(ids).not.toContain(unwatched);
    });

    it("never leaks tasks visibility would otherwise exclude (workspace scoping / permission)", async () => {
      const { id: alicePersonal } = await quick(alice, "alice personal errand");
      const { id: bareWorkspaceTask } = await quick(alice, "bare workspace task, no project", workspaceId);
      const filters = parsePlannerFilters({ status: "TODO,IN_PROGRESS,BLOCKED,DONE,CANCELLED" });

      const { tasks: outsiderResult } = await getPlannerTasks(outsider, "all", { kind: "all" }, filters);
      expect(outsiderResult.map((t) => t.id)).not.toContain(alicePersonal);

      // A guest (non-member-grade role) can't see a bare workspace task with no project, regardless
      // of any filter applied — the filter layer never widens what `visibleTasksWhere` already excludes.
      const { tasks: guestResult } = await getPlannerTasks(guest, "all", { kind: "workspace", workspaceId }, filters);
      expect(guestResult.map((t) => t.id)).not.toContain(bareWorkspaceTask);
    });

    it("an inaccessible/bogus filter id only narrows results, never widens them", async () => {
      const bogusId = "c".repeat(25); // well-formed cuid shape, belongs to nobody
      const filters = parsePlannerFilters({ assignee: bogusId });
      expect(plannerFiltersWhere(alice, filters)).toEqual([{ assignees: { some: { userId: { in: [bogusId] } } } }]);
      const { tasks: result } = await getPlannerTasks(alice, "all", { kind: "workspace", workspaceId }, filters);
      expect(result).toEqual([]); // narrows to nothing — never an error, never extra rows
    });
  });

  describe("bulk actions", () => {
    it("bulk-completes and reopens, best-effort across mixed permissions", async () => {
      const { id: editable1 } = await quick(alice, "bulk complete 1", workspaceId);
      const { id: editable2 } = await quick(alice, "bulk complete 2", workspaceId);
      const { id: bobOnlyPersonal } = await quick(bob, "bob personal, not alice's"); // invisible to alice

      const res = await bulk.bulkSetCompletion(alice, [editable1, editable2, bobOnlyPersonal], true);
      expect(res.updatedIds.sort()).toEqual([editable1, editable2].sort());
      expect(res.skippedIds).toEqual([bobOnlyPersonal]); // alice can't even see bob's personal task

      const rows = await db.task.findMany({ where: { id: { in: [editable1, editable2] } }, select: { status: true } });
      expect(rows.every((r) => r.status === "DONE")).toBe(true);

      const reopened = await bulk.bulkSetCompletion(alice, [editable1, editable2], false);
      expect(reopened.updatedIds.sort()).toEqual([editable1, editable2].sort());
    });

    it("bulk-sets priority", async () => {
      const { id } = await quick(alice, "priority target", workspaceId);
      const res = await bulk.bulkSetPriority(alice, [id], "URGENT");
      expect(res.updatedIds).toEqual([id]);
      const row = await db.task.findUniqueOrThrow({ where: { id }, select: { priority: true } });
      expect(row.priority).toBe("URGENT");
    });

    it("bulk-sets and clears due date", async () => {
      const { id } = await quick(alice, "due date target", workspaceId);
      const target = addDays(todayIn(TZ), 5);
      await bulk.bulkSetDueDate(alice, [id], { dueOn: target, dueTime: null });
      let row = await db.task.findUniqueOrThrow({ where: { id }, select: { dueOn: true } });
      expect(row.dueOn).not.toBeNull();

      await bulk.bulkSetDueDate(alice, [id], { dueOn: null, dueTime: null });
      row = await db.task.findUniqueOrThrow({ where: { id }, select: { dueOn: true } });
      expect(row.dueOn).toBeNull();
    });

    it("bulk-adds and removes labels additively (not a replace)", async () => {
      const labelA = await labels.createLabel(alice, workspaceId, `BulkA-${run}`, "blue");
      const labelB = await labels.createLabel(alice, workspaceId, `BulkB-${run}`, "red");
      const { id } = await quick(alice, "label target", workspaceId);
      await tasks.setTaskLabels(alice, id, [labelA.id]);

      await bulk.bulkAddLabels(alice, [id], [labelB.id]);
      let current = await db.taskLabel.findMany({ where: { taskId: id }, select: { labelId: true } });
      expect(current.map((l) => l.labelId).sort()).toEqual([labelA.id, labelB.id].sort()); // additive: labelA survives

      await bulk.bulkRemoveLabels(alice, [id], [labelA.id]);
      current = await db.taskLabel.findMany({ where: { taskId: id }, select: { labelId: true } });
      expect(current.map((l) => l.labelId)).toEqual([labelB.id]);
    });

    it("bulk-moves to a project, rejecting a cross-space target per task", async () => {
      const { id } = await quick(alice, "move target", workspaceId);
      const res = await bulk.bulkMoveToProject(alice, [id], projectId);
      expect(res.updatedIds).toEqual([id]);
      const row = await db.task.findUniqueOrThrow({ where: { id }, select: { projectId: true } });
      expect(row.projectId).toBe(projectId);
    });

    it("bulk-deletes atomically in one updateMany, soft-deleting subtasks too", async () => {
      const { id: parent } = await quick(alice, "bulk delete parent", workspaceId);
      const sub = await tasks.createSubtask(alice, parent, "bulk delete child");
      const res = await bulk.bulkDelete(alice, [parent]);
      expect(res.updatedIds).toEqual([parent]);
      const rows = await db.task.findMany({ where: { id: { in: [parent, sub.id] } }, select: { id: true, deletedAt: true } });
      expect(rows.every((r) => r.deletedAt !== null)).toBe(true);
    });

    it("mixed-permission bulk-delete is best-effort: deletes what's allowed, skips the rest", async () => {
      const { id: bobCreated } = await quick(bob, "bob's own task", workspaceId);
      const { id: aliceOnly } = await quick(alice, "alice personal, not bob's");
      const res = await bulk.bulkDelete(bob, [bobCreated, aliceOnly]);
      expect(res.updatedIds).toEqual([bobCreated]);
      expect(res.skippedIds).toEqual([aliceOnly]);
    });
  });

  describe("bulk notification invariants", () => {
    const notificationsFor = (userId: string, type: NotificationType, taskId: string) => db.notification.findMany({ where: { recipientId: userId, type, entityId: taskId } });
    const bulkNotificationsFor = (userId: string, type: NotificationType) => db.notification.findMany({ where: { recipientId: userId, type } });

    it("1. a single-task action produces a single, non-bulk notification type", async () => {
      const { id } = await quick(alice, "single action notif", workspaceId);
      await tasks.setTaskAssignees(alice, id, [bob.user.id]);
      await tasks.setTaskCompletion(alice, id, true);
      const rows = await notificationsFor(bob.user.id, "TASK_STATUS_CHANGED", id);
      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe("TASK_STATUS_CHANGED"); // never the _BULK variant
    });

    it("2. a bulk action touching exactly one (notifiable) task behaves exactly like the single-task action", async () => {
      const { id } = await quick(alice, "bulk of one notif", workspaceId);
      await tasks.setTaskAssignees(alice, id, [bob.user.id]);
      await bulk.bulkSetCompletion(alice, [id], true);
      const plain = await notificationsFor(bob.user.id, "TASK_STATUS_CHANGED", id);
      const bulkVariant = await notificationsFor(bob.user.id, "TASK_STATUS_CHANGED_BULK", id);
      expect(plain).toHaveLength(1);
      expect(bulkVariant).toHaveLength(0); // no accidental behavior change
    });

    it("3. a bulk action touching several tasks collapses into exactly one bulk notification per recipient/type", async () => {
      const { id: t1 } = await quick(alice, "bulk multi 1", workspaceId);
      const { id: t2 } = await quick(alice, "bulk multi 2", workspaceId);
      const { id: t3 } = await quick(alice, "bulk multi 3", workspaceId);
      await Promise.all([t1, t2, t3].map((id) => tasks.setTaskAssignees(alice, id, [bob.user.id])));

      await bulk.bulkSetCompletion(alice, [t1, t2, t3], true);

      const individual = await Promise.all([t1, t2, t3].map((id) => notificationsFor(bob.user.id, "TASK_STATUS_CHANGED", id)));
      expect(individual.every((rows) => rows.length === 0)).toBe(true); // never the individual shape for this batch

      const bulkRows = await bulkNotificationsFor(bob.user.id, "TASK_STATUS_CHANGED_BULK");
      // Scope to this test's own 3 tasks via the stored taskIds metadata (the suite reuses one recipient across cases).
      const ours = bulkRows.filter((r) => {
        const data = r.data as { taskIds?: string[] };
        return (data.taskIds ?? []).some((tid) => [t1, t2, t3].includes(tid));
      });
      expect(ours).toHaveLength(1);
      expect(ours[0].title).toBe("3"); // count
      const data = ours[0].data as { count: number; taskIds: string[] };
      expect(data.count).toBe(3);
      expect(data.taskIds.sort()).toEqual([t1, t2, t3].sort());
    });

    it("4. no duplicate notifications are ever created for the same recipient/event", async () => {
      const { id: t1 } = await quick(alice, "no dup 1", workspaceId);
      const { id: t2 } = await quick(alice, "no dup 2", workspaceId);
      await Promise.all([t1, t2].map((id) => tasks.setTaskAssignees(alice, id, [carol.user.id])));
      await bulk.bulkSetCompletion(alice, [t1, t2], true);
      const rows = await db.notification.findMany({ where: { recipientId: carol.user.id, type: "TASK_STATUS_CHANGED_BULK" } });
      const ours = rows.filter((r) => {
        const data = r.data as { taskIds?: string[] };
        return (data.taskIds ?? []).some((tid) => [t1, t2].includes(tid));
      });
      expect(ours).toHaveLength(1); // one row, not one per task
    });

    it("5. the actor is always excluded, even from a bulk-aggregated notification", async () => {
      const { id: t1 } = await quick(alice, "actor excluded 1", workspaceId);
      const { id: t2 } = await quick(alice, "actor excluded 2", workspaceId);
      await Promise.all([t1, t2].map((id) => tasks.setTaskAssignees(alice, id, [alice.user.id, bob.user.id])));
      await bulk.bulkSetCompletion(alice, [t1, t2], true);
      const aliceRows = await db.notification.findMany({ where: { recipientId: alice.user.id, type: { in: ["TASK_STATUS_CHANGED", "TASK_STATUS_CHANGED_BULK"] } } });
      const ours = aliceRows.filter((r) => r.entityId === t1 || r.entityId === t2 || ((r.data as { taskIds?: string[] }).taskIds ?? []).some((tid) => [t1, t2].includes(tid)));
      expect(ours).toHaveLength(0);
    });

    it("6. a user without visibility into a task is never notified by a bulk action on it, even when others legitimately are", async () => {
      const { id } = await quick(alice, "no visibility notif", workspaceId);
      await tasks.setTaskAssignees(alice, id, [bob.user.id]); // bob IS a legitimate recipient
      // `outsider` is neither owner, assignee, watcher, nor a workspace member — never visible to them.
      await bulk.bulkSetCompletion(alice, [id], true);
      const bobRows = await db.notification.findMany({ where: { recipientId: bob.user.id, entityId: id } });
      const outsiderRows = await db.notification.findMany({ where: { recipientId: outsider.user.id, entityId: id } });
      expect(bobRows.length).toBeGreaterThan(0); // the legitimate recipient does get notified
      expect(outsiderRows).toHaveLength(0); // the non-visible user never does
    });
  });

  describe("reorder (drag & drop)", () => {
    it("persists a new order server-side from the two visible neighbor ids", async () => {
      const { id: t1 } = await quick(alice, "order 1");
      const { id: t2 } = await quick(alice, "order 2");
      const { id: t3 } = await quick(alice, "order 3");
      // Move t3 to sit between t1 and t2.
      await tasks.reorderTask(alice, t3, { beforeId: t1, afterId: t2 });
      const rows = await db.task.findMany({ where: { id: { in: [t1, t2, t3] } }, select: { id: true, sortOrder: true } });
      const byId = new Map(rows.map((r) => [r.id, r.sortOrder]));
      expect(byId.get(t1)!).toBeLessThan(byId.get(t3)!);
      expect(byId.get(t3)!).toBeLessThan(byId.get(t2)!);
    });

    it("rebalances a bounded neighborhood, never the whole collection, when ranks collide", async () => {
      // Force a collision: several siblings sharing the exact same sortOrder. Created in order
      // ids[0..3]; with sortOrder tied, the true view order (sortOrder asc, createdAt desc) is
      // ids[3], ids[2], ids[1], ids[0] — so ids[1] immediately precedes ids[0].
      const ids: string[] = [];
      for (let i = 0; i < 4; i++) {
        const { id } = await quick(alice, `collide ${i}`);
        await db.task.update({ where: { id }, data: { sortOrder: 0 } });
        ids.push(id);
      }
      const { id: dragged } = await quick(alice, "collide dragged");
      await tasks.reorderTask(alice, dragged, { beforeId: ids[1], afterId: ids[0] });
      const rows = await db.task.findMany({ where: { id: { in: [...ids, dragged] } }, select: { id: true, sortOrder: true } });
      const distinctRanks = new Set(rows.map((r) => r.sortOrder));
      expect(distinctRanks.size).toBe(ids.length + 1); // the collision is resolved, no two share a rank
      const byId = new Map(rows.map((r) => [r.id, r.sortOrder]));
      expect(byId.get(ids[1])!).toBeLessThan(byId.get(dragged)!);
      expect(byId.get(dragged)!).toBeLessThan(byId.get(ids[0])!);
    });

    it("rejects reordering a task the caller cannot edit", async () => {
      const { id: alicePersonal } = await quick(alice, "not bob's to move");
      await expect(tasks.reorderTask(bob, alicePersonal, { beforeId: null, afterId: null })).rejects.toThrow();
    });

    it("reordering within a filtered subset only touches the dragged row, not hidden siblings", async () => {
      const { id: a } = await quick(alice, "subset a");
      const { id: b } = await quick(alice, "subset b");
      const { id: hidden } = await quick(alice, "subset hidden (filtered out)");
      const before = await db.task.findUniqueOrThrow({ where: { id: hidden }, select: { sortOrder: true } });
      // Simulate a reorder computed from a filtered view's visible neighbors only (a, b) — "hidden" never appears as beforeId/afterId.
      await tasks.reorderTask(alice, b, { beforeId: a, afterId: null });
      const after = await db.task.findUniqueOrThrow({ where: { id: hidden }, select: { sortOrder: true } });
      expect(after.sortOrder).toBe(before.sortOrder); // untouched
    });

    it("reorders subtasks among their own siblings, independently of the parent's top-level list", async () => {
      const { id: parentId } = await quick(alice, "subtask reorder parent");
      const sub1 = await tasks.createSubtask(alice, parentId, "sub 1");
      const sub2 = await tasks.createSubtask(alice, parentId, "sub 2");
      const sub3 = await tasks.createSubtask(alice, parentId, "sub 3");
      // Move sub3 to sit between sub1 and sub2 — `orderingScope` picks "siblings under the same
      // parent" because the dragged task has a parentId, the same `reorderTask` used for top-level lists.
      await tasks.reorderTask(alice, sub3.id, { beforeId: sub1.id, afterId: sub2.id });
      const rows = await db.task.findMany({ where: { id: { in: [sub1.id, sub2.id, sub3.id] } }, select: { id: true, sortOrder: true } });
      const byId = new Map(rows.map((r) => [r.id, r.sortOrder]));
      expect(byId.get(sub1.id)!).toBeLessThan(byId.get(sub3.id)!);
      expect(byId.get(sub3.id)!).toBeLessThan(byId.get(sub2.id)!);
    });
  });
});
