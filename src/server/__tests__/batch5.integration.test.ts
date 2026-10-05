import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, todayIn, toDbDate } from "@/lib/time";
import { db } from "@/server/db";
import type { Viewer } from "@/server/context";
import * as milestones from "@/features/milestones/server/service";
import { getMilestones } from "@/features/milestones/server/queries";
import * as sections from "@/features/projects/server/sections";
import { getBoardData, getTaskDetail, getTimelineTasks } from "@/features/tasks/server/queries";
import * as tasks from "@/features/tasks/server/service";
import { hasDatabase, fixtureRun } from "./helpers";

// Batch 5: board (ProjectSection columns + card move/reorder), timeline (date-windowed query +
// the start-date UI/action gap this batch closed), milestones (CRUD, progress, task linking).
const suite = hasDatabase ? describe : describe.skip;

const TZ = "Asia/Tehran";

const quick = (viewer: Viewer, input: string, context = "personal", extra: Partial<{ projectId: string; view: string }> = {}) =>
  tasks.createTaskFromQuickAdd(viewer, { input, clientMutationId: randomUUID(), context, projectId: extra.projectId ?? null, view: extra.view ?? null });

suite("Batch 5: board, timeline, milestones (integration)", () => {
  const fixture = fixtureRun(TZ);
  let alice: Viewer;
  let bob: Viewer;
  let outsider: Viewer;
  let workspaceId: string;
  let projectId: string;

  beforeAll(async () => {
    const a = await fixture.makeUser("alice");
    const b = await fixture.makeUser("bob");
    const o = await fixture.makeUser("outsider");
    const ws = await fixture.makeWorkspace(a.id, [{ userId: b.id, role: "MEMBER" }]);
    workspaceId = ws.id;
    const project = await db.project.create({
      data: { scope: "WORKSPACE", workspaceId, ownerId: a.id, createdById: a.id, name: "Batch5 Project", visibility: "WORKSPACE", members: { create: { userId: a.id, role: "LEAD" } } },
    });
    projectId = project.id;
    [alice, bob, outsider] = await Promise.all([fixture.viewerFor(a.id), fixture.viewerFor(b.id), fixture.viewerFor(o.id)]);
  });

  afterAll(fixture.cleanup);

  describe("board columns (ProjectSection)", () => {
    it("creates columns appended at the end, in order", async () => {
      const col1 = await sections.createSection(alice, projectId, "To do");
      const col2 = await sections.createSection(alice, projectId, "Doing");
      const list = await sections.listSections(alice, projectId);
      const ids = list.map((s) => s.id);
      expect(ids.indexOf(col1.id)).toBeLessThan(ids.indexOf(col2.id));
    });

    it("rejects column creation from someone without project edit rights", async () => {
      // bob is a workspace MEMBER but not a project member/lead/editor, and the project is private-ish
      // in the sense that only canEditProject passes — a plain member has no projects.edit by default here.
      await expect(sections.createSection(bob, projectId, "Nope")).rejects.toThrow();
    });

    it("reorders columns from the two visible neighbor ids", async () => {
      const a = await sections.createSection(alice, projectId, "A");
      const b = await sections.createSection(alice, projectId, "B");
      const c = await sections.createSection(alice, projectId, "C");
      await sections.reorderSection(alice, c.id, { beforeId: a.id, afterId: b.id });
      const list = await sections.listSections(alice, projectId);
      const rankOf = (id: string) => list.find((s) => s.id === id)!.sortOrder;
      expect(rankOf(a.id)).toBeLessThan(rankOf(c.id));
      expect(rankOf(c.id)).toBeLessThan(rankOf(b.id));
    });

    it("archiving a column unlinks its tasks instead of deleting them", async () => {
      const col = await sections.createSection(alice, projectId, "Archive me");
      const { id: taskId } = await quick(alice, "task in archived column", workspaceId, { projectId });
      await tasks.moveTaskToSection(alice, taskId, { sectionId: col.id, beforeId: null, afterId: null });
      await sections.archiveSection(alice, col.id);
      const list = await sections.listSections(alice, projectId);
      expect(list.some((s) => s.id === col.id)).toBe(false);
      const row = await db.task.findUniqueOrThrow({ where: { id: taskId }, select: { sectionId: true, deletedAt: true } });
      expect(row.sectionId).toBeNull();
      expect(row.deletedAt).toBeNull();
    });
  });

  describe("moveTaskToSection (board card drag)", () => {
    it("moves a task into a column and ranks it from the two neighbor ids", async () => {
      const col = await sections.createSection(alice, projectId, "Move target");
      const { id: t1 } = await quick(alice, "move 1", workspaceId, { projectId });
      const { id: t2 } = await quick(alice, "move 2", workspaceId, { projectId });
      const { id: t3 } = await quick(alice, "move 3", workspaceId, { projectId });
      await tasks.moveTaskToSection(alice, t1, { sectionId: col.id, beforeId: null, afterId: null });
      await tasks.moveTaskToSection(alice, t2, { sectionId: col.id, beforeId: t1, afterId: null });
      await tasks.moveTaskToSection(alice, t3, { sectionId: col.id, beforeId: t1, afterId: t2 });
      const rows = await db.task.findMany({ where: { id: { in: [t1, t2, t3] } }, select: { id: true, sortOrder: true, sectionId: true } });
      expect(rows.every((r) => r.sectionId === col.id)).toBe(true);
      const byId = new Map(rows.map((r) => [r.id, r.sortOrder]));
      expect(byId.get(t1)!).toBeLessThan(byId.get(t3)!);
      expect(byId.get(t3)!).toBeLessThan(byId.get(t2)!);
    });

    it("records a section_changed activity only when the column actually changes", async () => {
      const col = await sections.createSection(alice, projectId, "Activity check");
      const { id: taskId } = await quick(alice, "activity task", workspaceId, { projectId });
      await tasks.moveTaskToSection(alice, taskId, { sectionId: col.id, beforeId: null, afterId: null });
      const afterFirstMove = await db.activity.count({ where: { entityType: "task", entityId: taskId, action: "section_changed" } });
      expect(afterFirstMove).toBe(1);
      // Reordering within the SAME column (sectionId unchanged) must not log a second section_changed.
      await tasks.moveTaskToSection(alice, taskId, { sectionId: col.id, beforeId: null, afterId: null });
      const afterNoopMove = await db.activity.count({ where: { entityType: "task", entityId: taskId, action: "section_changed" } });
      expect(afterNoopMove).toBe(1);
    });

    it("rejects moving a task the caller cannot edit", async () => {
      const { id: alicePersonal } = await quick(alice, "not bob's to move");
      await expect(tasks.moveTaskToSection(bob, alicePersonal, { sectionId: null, beforeId: null, afterId: null })).rejects.toThrow();
    });

    it("rejects a task with no project (board moves are project-scoped)", async () => {
      const { id: personalTask } = await quick(alice, "no project task");
      await expect(tasks.moveTaskToSection(alice, personalTask, { sectionId: null, beforeId: null, afterId: null })).rejects.toThrow();
    });

    it("rejects a section id that belongs to a different project", async () => {
      const otherProject = await db.project.create({ data: { scope: "WORKSPACE", workspaceId, ownerId: alice.user.id, createdById: alice.user.id, name: "Other project" } });
      const foreignSection = await sections.createSection(alice, otherProject.id, "Foreign column");
      const { id: taskId } = await quick(alice, "cross project move", workspaceId, { projectId });
      await expect(tasks.moveTaskToSection(alice, taskId, { sectionId: foreignSection.id, beforeId: null, afterId: null })).rejects.toThrow();
    });

    it("a drag within a filtered board subset only touches the dragged card, not hidden siblings", async () => {
      const col = await sections.createSection(alice, projectId, "Filtered subset");
      const { id: visible1 } = await quick(alice, "visible 1", workspaceId, { projectId });
      const { id: visible2 } = await quick(alice, "visible 2", workspaceId, { projectId });
      const { id: hidden } = await quick(alice, "hidden by filter", workspaceId, { projectId });
      await Promise.all(
        [visible1, visible2, hidden].map((id) => tasks.moveTaskToSection(alice, id, { sectionId: col.id, beforeId: null, afterId: null })),
      );
      const before = await db.task.findUniqueOrThrow({ where: { id: hidden }, select: { sortOrder: true } });
      // Simulate a board filtered to hide `hidden` — the drag only ever sees visible1/visible2 as neighbors.
      await tasks.moveTaskToSection(alice, visible2, { sectionId: col.id, beforeId: visible1, afterId: null });
      const after = await db.task.findUniqueOrThrow({ where: { id: hidden }, select: { sortOrder: true } });
      expect(after.sortOrder).toBe(before.sortOrder);
    });
  });

  describe("getBoardData", () => {
    it("groups tasks into the unsectioned column and real columns, workspace/project-scoped", async () => {
      const col = await sections.createSection(alice, projectId, "Board data column");
      const { id: sectioned } = await quick(alice, "sectioned task", workspaceId, { projectId });
      await tasks.moveTaskToSection(alice, sectioned, { sectionId: col.id, beforeId: null, afterId: null });
      const { id: unsectioned } = await quick(alice, "unsectioned task", workspaceId, { projectId });

      const board = await getBoardData(alice, projectId);
      expect(board).not.toBeNull();
      const unsectionedColumn = board!.columns.find((c) => c.id === null)!;
      const namedColumn = board!.columns.find((c) => c.id === col.id)!;
      expect(unsectionedColumn.tasks.some((t) => t.id === unsectioned)).toBe(true);
      expect(namedColumn.tasks.some((t) => t.id === sectioned)).toBe(true);
    });

    it("returns null for a project the viewer cannot see", async () => {
      const board = await getBoardData(outsider, projectId);
      expect(board).toBeNull();
    });
  });

  describe("timeline (start-date support + windowed query)", () => {
    it("updateTask now accepts a start date, validated against the due date", async () => {
      const { id } = await quick(alice, "timeline task with dates", workspaceId, { projectId });
      const task = await getTaskDetail(alice, id);
      await tasks.updateTask(alice, { taskId: id, expectedVersion: task!.version, dueOn: addDays(todayIn(TZ), 10) });
      const afterDue = await getTaskDetail(alice, id);
      await tasks.updateTask(alice, { taskId: id, expectedVersion: afterDue!.version, startOn: addDays(todayIn(TZ), 3) });
      const row = await db.task.findUniqueOrThrow({ where: { id }, select: { startOn: true, dueOn: true } });
      expect(row.startOn).not.toBeNull();
      expect(row.dueOn).not.toBeNull();
    });

    it("rejects a start date after the due date", async () => {
      const { id } = await quick(alice, "bad schedule", workspaceId, { projectId });
      const task = await getTaskDetail(alice, id);
      await tasks.updateTask(alice, { taskId: id, expectedVersion: task!.version, dueOn: todayIn(TZ) });
      const afterDue = await getTaskDetail(alice, id);
      await expect(tasks.updateTask(alice, { taskId: id, expectedVersion: afterDue!.version, startOn: addDays(todayIn(TZ), 5) })).rejects.toThrow();
    });

    it("includes only tasks whose start/due span overlaps the window, and counts dateless tasks separately", async () => {
      const today = todayIn(TZ);
      const { id: inWindow } = await quick(alice, "in window", workspaceId, { projectId });
      await db.task.update({ where: { id: inWindow }, data: { dueOn: toDbDate(addDays(today, 2)) } });
      const { id: beforeWindow } = await quick(alice, "before window", workspaceId, { projectId });
      await db.task.update({ where: { id: beforeWindow }, data: { dueOn: toDbDate(addDays(today, -30)), startOn: toDbDate(addDays(today, -31)) } });
      const { id: afterWindow } = await quick(alice, "after window", workspaceId, { projectId });
      await db.task.update({ where: { id: afterWindow }, data: { startOn: toDbDate(addDays(today, 30)) } });
      await quick(alice, "dateless", workspaceId, { projectId });

      const result = await getTimelineTasks(alice, projectId, { from: today, to: addDays(today, 6) });
      expect(result).not.toBeNull();
      const ids = result!.tasks.map((t) => t.id);
      expect(ids).toContain(inWindow);
      expect(ids).not.toContain(beforeWindow);
      expect(ids).not.toContain(afterWindow);
      expect(result!.noDateCount).toBeGreaterThanOrEqual(1);
    });

    it("never reveals a task the viewer can't otherwise see, even within the date window", async () => {
      const today = todayIn(TZ);
      const result = await getTimelineTasks(outsider, projectId, { from: today, to: addDays(today, 6) });
      expect(result).toBeNull(); // outsider can't see the project at all
    });
  });

  describe("milestones", () => {
    it("requires project edit rights to create", async () => {
      await expect(milestones.createMilestone(bob, projectId, { title: "Nope", description: null, dueOn: null })).rejects.toThrow();
    });

    it("computes progress from associated tasks, never a stored value", async () => {
      const m = await milestones.createMilestone(alice, projectId, { title: "Launch", description: null, dueOn: null });
      const { id: t1 } = await quick(alice, "milestone task 1", workspaceId, { projectId });
      const { id: t2 } = await quick(alice, "milestone task 2", workspaceId, { projectId });
      await Promise.all([t1, t2].map((id) => db.task.update({ where: { id }, data: { milestoneId: m.id } })));

      let list = await getMilestones(alice, projectId);
      let row = list!.find((x) => x.id === m.id)!;
      expect(row.progress).toEqual({ done: 0, total: 2 });

      await tasks.setTaskCompletion(alice, t1, true);
      list = await getMilestones(alice, projectId);
      row = list!.find((x) => x.id === m.id)!;
      expect(row.progress).toEqual({ done: 1, total: 2 });
    });

    it("is overdue only when OPEN and the due date is in the past", async () => {
      const today = todayIn(TZ);
      const overdue = await milestones.createMilestone(alice, projectId, { title: "Overdue one", description: null, dueOn: addDays(today, -1) });
      const list = await getMilestones(alice, projectId);
      expect(list!.find((m) => m.id === overdue.id)!.isOverdue).toBe(true);

      await milestones.setMilestoneCompletion(alice, overdue.id, true);
      const afterComplete = await getMilestones(alice, projectId);
      expect(afterComplete!.find((m) => m.id === overdue.id)!.isOverdue).toBe(false); // completed overdue isn't "overdue" anymore
    });

    it("archiving unlinks tasks instead of leaving a dangling reference", async () => {
      const m = await milestones.createMilestone(alice, projectId, { title: "To archive", description: null, dueOn: null });
      const { id: taskId } = await quick(alice, "linked to archived milestone", workspaceId, { projectId });
      await db.task.update({ where: { id: taskId }, data: { milestoneId: m.id } });
      await milestones.archiveMilestone(alice, m.id);
      const list = await getMilestones(alice, projectId);
      expect(list!.some((x) => x.id === m.id)).toBe(false);
      const row = await db.task.findUniqueOrThrow({ where: { id: taskId }, select: { milestoneId: true } });
      expect(row.milestoneId).toBeNull();
    });

    it("reorders milestones from the two visible neighbor ids", async () => {
      const a = await milestones.createMilestone(alice, projectId, { title: "M-A", description: null, dueOn: null });
      const b = await milestones.createMilestone(alice, projectId, { title: "M-B", description: null, dueOn: null });
      const c = await milestones.createMilestone(alice, projectId, { title: "M-C", description: null, dueOn: null });
      await milestones.reorderMilestone(alice, c.id, { beforeId: a.id, afterId: b.id });
      const list = await getMilestones(alice, projectId);
      const rankOf = (id: string) => list!.findIndex((m) => m.id === id);
      expect(rankOf(a.id)).toBeLessThan(rankOf(c.id));
      expect(rankOf(c.id)).toBeLessThan(rankOf(b.id));
    });

    it("linking a task to a milestone (via updateTask) rejects a milestone from a different project", async () => {
      const otherProject = await db.project.create({ data: { scope: "WORKSPACE", workspaceId, ownerId: alice.user.id, createdById: alice.user.id, name: "Other project 2" } });
      const foreignMilestone = await milestones.createMilestone(alice, otherProject.id, { title: "Foreign milestone", description: null, dueOn: null });
      const { id: taskId } = await quick(alice, "link attempt", workspaceId, { projectId });
      const task = await getTaskDetail(alice, taskId);
      await expect(tasks.updateTask(alice, { taskId, expectedVersion: task!.version, milestoneId: foreignMilestone.id })).rejects.toThrow();
    });

    it("linking a task to a same-project milestone succeeds, and moving the task to another project clears the link", async () => {
      const m = await milestones.createMilestone(alice, projectId, { title: "Same project milestone", description: null, dueOn: null });
      const { id: taskId } = await quick(alice, "link success", workspaceId, { projectId });
      const task = await getTaskDetail(alice, taskId);
      await tasks.updateTask(alice, { taskId, expectedVersion: task!.version, milestoneId: m.id });
      let row = await db.task.findUniqueOrThrow({ where: { id: taskId }, select: { milestoneId: true, version: true } });
      expect(row.milestoneId).toBe(m.id);

      const otherProject = await db.project.create({ data: { scope: "WORKSPACE", workspaceId, ownerId: alice.user.id, createdById: alice.user.id, name: "Other project 3" } });
      await tasks.updateTask(alice, { taskId, expectedVersion: row.version, projectId: otherProject.id });
      row = await db.task.findUniqueOrThrow({ where: { id: taskId }, select: { milestoneId: true, version: true } });
      expect(row.milestoneId).toBeNull();
    });
  });

  describe("subtask canEdit (TaskSheet DnD carry-over)", () => {
    it("getTaskDetail reports per-subtask edit rights, not just the parent's", async () => {
      const { id: parentId } = await quick(alice, "subtask canEdit parent", workspaceId, { projectId });
      const sub = await tasks.createSubtask(alice, parentId, "sub with assignee");
      await tasks.setTaskAssignees(alice, sub.id, [bob.user.id]);

      const asAlice = await getTaskDetail(alice, parentId);
      expect(asAlice!.subtasks.find((s) => s.id === sub.id)!.canEdit).toBe(true); // alice owns it

      const asBob = await getTaskDetail(bob, parentId);
      // bob is only an assignee on the subtask, not a member/lead on the project in a way that grants
      // edit — but being an assignee IS enough per canEditTask's own rule, so this should be true too;
      // the real point of this test is that it's computed from the SUBTASK's own policy fields, not
      // copied from the parent's `canEdit` (bob can't edit the parent task at all).
      expect(asBob).not.toBeNull();
      expect(asBob!.canEdit).toBe(false); // bob has no rights on the parent task itself
      expect(asBob!.subtasks.find((s) => s.id === sub.id)!.canEdit).toBe(true); // but does on the subtask, as its assignee
    });
  });
});
