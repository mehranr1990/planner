import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, todayIn } from "@/lib/time";
import { NOT_FOUND } from "@/lib/action-result";
import { db } from "@/server/db";
import { DomainError } from "@/server/errors";
import type { Viewer } from "@/server/context";
import { normalizeSchedule } from "@/features/tasks/domain/schedule";
import { createTask } from "@/features/tasks/server/create";
import * as tasks from "@/features/tasks/server/service";
import * as projects from "@/features/projects/server/service";
import * as workspaces from "@/features/workspace/server/service";
import * as auth from "@/features/auth/server/service";
import { fixtureRun, hasDatabase } from "./helpers";

const suite = hasDatabase ? describe : describe.skip;
const f = fixtureRun();
const TZ = "Asia/Tehran";

const code = (p: Promise<unknown>) =>
  p.then(
    () => "resolved",
    (e) => (e instanceof DomainError ? e.code : `unexpected: ${e instanceof Error ? e.message : String(e)}`),
  );

const activityFor = (taskId: string) => db.activity.findMany({ where: { entityType: "task", entityId: taskId }, orderBy: { createdAt: "asc" } });

let owner: Viewer;
let member: Viewer;
let guest: Viewer;
let outsider: Viewer;
let workspaceId: string;

suite("service layer (integration)", () => {
  beforeAll(async () => {
    const [o, m, g, x] = await Promise.all([f.makeUser("owner"), f.makeUser("member"), f.makeUser("guest"), f.makeUser("outsider")]);
    const ws = await f.makeWorkspace(o.id, [
      { userId: m.id, role: "MEMBER" },
      { userId: g.id, role: "GUEST" },
    ]);
    workspaceId = ws.id;
    [owner, member, guest, outsider] = await Promise.all([f.viewerFor(o.id), f.viewerFor(m.id), f.viewerFor(g.id), f.viewerFor(x.id)]);
  });
  afterAll(() => f.cleanup());

  describe("shared task creation core", () => {
    const base = () => ({
      ownerId: owner.user.id,
      createdById: owner.user.id,
      schedule: normalizeSchedule({ timezone: TZ }),
    });

    it("derives scope from the project, ignoring the caller's scope", async () => {
      const p = await projects.createProject(owner, { name: "Core scope", description: null, color: "blue", context: workspaceId, visibility: "WORKSPACE" });
      const { id } = await db.$transaction((tx) =>
        createTask(tx, { ...base(), source: { kind: "AUTOMATION" }, scope: { scope: "PERSONAL", workspaceId: null }, projectId: p.id, title: "Into the project" }),
      );
      const row = await db.task.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({ scope: "WORKSPACE", workspaceId, projectId: p.id });
    });

    it("records the source on the creation activity", async () => {
      const { id } = await db.$transaction((tx) =>
        createTask(tx, { ...base(), source: { kind: "CHAT", ref: { type: "message", id: "m_1" } }, scope: { scope: "PERSONAL", workspaceId: null }, title: "From chat" }),
      );
      const [a] = await activityFor(id);
      expect(a).toMatchObject({ action: "created", data: { source: "CHAT", ref: { type: "message", id: "m_1" } } });
    });

    it("resolves a repeated clientMutationId to the same task without aborting the transaction", async () => {
      const clientMutationId = randomUUID();
      const input = { ...base(), source: { kind: "QUICK_ADD" as const }, scope: { scope: "PERSONAL" as const, workspaceId: null }, title: "Once", clientMutationId };
      const result = await db.$transaction(async (tx) => {
        const first = await createTask(tx, input);
        const second = await createTask(tx, input);
        const stillUsable = await tx.task.count({ where: { clientMutationId } }); // tx not aborted
        return { first, second, stillUsable };
      });
      expect(result.first.created).toBe(true);
      expect(result.second).toEqual({ id: result.first.id, created: false });
      expect(result.stillUsable).toBe(1);
      expect(await activityFor(result.first.id)).toHaveLength(1);
    });

    it("copies assignees and labels", async () => {
      const label = await db.label.create({ data: { scope: "PERSONAL", ownerId: owner.user.id, name: `core-${f.run}` } });
      const { id } = await db.$transaction((tx) =>
        createTask(tx, {
          ...base(),
          source: { kind: "DUPLICATE", ref: { type: "task", id: "t_src" } },
          scope: { scope: "PERSONAL", workspaceId: null },
          title: "Copy",
          assignees: [{ userId: owner.user.id, assignedById: owner.user.id }],
          labelIds: [label.id],
        }),
      );
      expect(await db.taskAssignee.count({ where: { taskId: id } })).toBe(1);
      expect(await db.taskLabel.count({ where: { taskId: id } })).toBe(1);
    });

    it("rejects a blank title and inconsistent scope", async () => {
      expect(await code(db.$transaction((tx) => createTask(tx, { ...base(), source: { kind: "FORM" }, scope: { scope: "PERSONAL", workspaceId: null }, title: "   " })))).toBe("titleRequired");
      await expect(db.$transaction((tx) => createTask(tx, { ...base(), source: { kind: "FORM" }, scope: { scope: "PERSONAL", workspaceId }, title: "x" }))).rejects.toThrow("inconsistent scope");
    });

    it("Quick Add and recurrence both go through it (source metadata proves the path)", async () => {
      const { id } = await tasks.createTaskFromQuickAdd(owner, { input: "Water plants today", clientMutationId: randomUUID(), context: "personal", projectId: null, view: null });
      expect((await activityFor(id))[0]?.data).toMatchObject({ source: "QUICK_ADD" });
      await db.taskAssignee.create({ data: { taskId: id, userId: owner.user.id, assignedById: owner.user.id } });
      await tasks.setTaskRecurrence(owner, id, "daily", "FIXED_SCHEDULE");
      const { nextOccurrenceId } = await tasks.setTaskCompletion(owner, id, true);
      expect(nextOccurrenceId).not.toBeNull();
      const [recurred] = await activityFor(nextOccurrenceId!);
      expect(recurred).toMatchObject({ action: "recurred", data: { source: "RECURRENCE", from: id } });
      const next = await db.task.findUniqueOrThrow({ where: { id: nextOccurrenceId! }, include: { assignees: true } });
      expect(next.assignees.map((a) => a.userId)).toEqual([owner.user.id]);
      expect(next.dueOn?.toISOString().slice(0, 10)).toBe(addDays(todayIn(TZ), 1));
      // Re-completing the old occurrence never creates another successor.
      await tasks.setTaskCompletion(owner, id, false);
      expect((await tasks.setTaskCompletion(owner, id, true)).nextOccurrenceId).toBeNull();
      expect(await db.task.count({ where: { seriesId: next.seriesId } })).toBe(2);
    });

    it("Quick Add into a project is tagged PROJECT and stays idempotent", async () => {
      const p = await projects.createProject(owner, { name: "QA proj", description: null, color: "blue", context: "personal", visibility: "PRIVATE" });
      const clientMutationId = randomUUID();
      const input = { input: "Ship it fri", clientMutationId, context: "personal", projectId: p.id, view: null };
      const [a, b] = await Promise.all([tasks.createTaskFromQuickAdd(owner, input), tasks.createTaskFromQuickAdd(owner, input)]);
      expect(a.id).toBe(b.id);
      expect([a.deduplicated, b.deduplicated].sort()).toEqual([false, true]);
      expect((await activityFor(a.id))[0]?.data).toMatchObject({ source: "PROJECT" });
    });
  });

  describe("project service", () => {
    it("personal projects are private and member-less", async () => {
      const { id } = await projects.createProject(owner, { name: "Mine", description: null, color: "green", context: "personal", visibility: "WORKSPACE" });
      const p = await db.project.findUniqueOrThrow({ where: { id }, include: { members: true } });
      expect(p).toMatchObject({ scope: "PERSONAL", workspaceId: null, visibility: "PRIVATE" });
      expect(p.members).toHaveLength(0);
    });

    it("workspace projects make the creator LEAD; guests and outsiders can't create", async () => {
      const { id } = await projects.createProject(member, { name: "Team", description: "d", color: "blue", context: workspaceId, visibility: "PRIVATE" });
      const p = await db.project.findUniqueOrThrow({ where: { id }, include: { members: true } });
      expect(p.members).toEqual([expect.objectContaining({ userId: member.user.id, role: "LEAD" })]);
      expect(await code(projects.createProject(guest, { name: "G", description: null, color: "blue", context: workspaceId, visibility: "WORKSPACE" }))).toBe("cannotCreateProjectsHere");
      expect(await code(projects.createProject(outsider, { name: "X", description: null, color: "blue", context: workspaceId, visibility: "WORKSPACE" }))).toBe("cannotCreateProjectsHere");
    });

    it("status change writes activity and an audit event with before/after", async () => {
      const { id } = await projects.createProject(owner, { name: "Audited", description: null, color: "blue", context: workspaceId, visibility: "WORKSPACE" });
      await projects.updateProjectStatus(owner, id, { health: "AT_RISK" });
      const audit = await db.auditEvent.findFirstOrThrow({ where: { targetId: id, action: "project.status_changed" } });
      expect(audit.before).toEqual({ status: "ACTIVE", health: "ON_TRACK" });
      expect(audit.after).toEqual({ status: "ACTIVE", health: "AT_RISK" });
    });

    it("only editors change status or archive; others get notFound", async () => {
      const { id } = await projects.createProject(owner, { name: "Locked", description: null, color: "blue", context: workspaceId, visibility: "WORKSPACE" });
      expect(await code(projects.updateProjectStatus(member, id, { status: "ON_HOLD" }))).toBe(NOT_FOUND); // visible, not editable
      expect(await code(projects.setProjectArchived(outsider, id, true))).toBe(NOT_FOUND); // not visible
      await projects.setProjectArchived(owner, id, true);
      expect((await db.project.findUniqueOrThrow({ where: { id } })).archivedAt).not.toBeNull();
      await projects.setProjectArchived(owner, id, false);
      expect((await db.project.findUniqueOrThrow({ where: { id } })).archivedAt).toBeNull();
      const actions = (await db.activity.findMany({ where: { entityType: "project", entityId: id }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
      expect(actions).toEqual(["created", "archived", "restored"]);
    });
  });

  describe("workspace service", () => {
    it("creates a workspace with an OWNER membership, active context and audit", async () => {
      const creator = await f.viewerFor((await f.makeUser("creator")).id);
      const { id } = await workspaces.createWorkspace(creator, { name: "نوروز Studio" });
      const ws = await db.workspace.findUniqueOrThrow({ where: { id }, include: { memberships: true } });
      expect(ws.memberships).toEqual([expect.objectContaining({ userId: creator.user.id, role: "OWNER" })]);
      expect(ws.slug).toMatch(/^studio-[0-9a-f]{6}$/);
      expect((await db.user.findUniqueOrThrow({ where: { id: creator.user.id } })).activeWorkspaceId).toBe(id);
      expect(await db.auditEvent.count({ where: { workspaceId: id, action: "workspace.created" } })).toBe(1);
    });

    it("switches only into workspaces the viewer belongs to", async () => {
      expect(await code(workspaces.switchContext(outsider, workspaceId))).toBe(NOT_FOUND);
      await workspaces.switchContext(member, workspaceId);
      await workspaces.switchContext(member, null);
      expect((await db.user.findUniqueOrThrow({ where: { id: member.user.id } })).activeWorkspaceId).toBeNull();
    });

    it("role changes follow rank rules and are audited", async () => {
      expect(await code(workspaces.changeMemberRole(member, { workspaceId, userId: guest.user.id, role: "MEMBER" }))).toBe("roleChangeForbidden");
      expect(await code(workspaces.changeMemberRole(owner, { workspaceId, userId: owner.user.id, role: "ADMIN" }))).toBe("roleChangeForbidden"); // no self-change
      await workspaces.changeMemberRole(owner, { workspaceId, userId: guest.user.id, role: "MEMBER" });
      const audit = await db.auditEvent.findFirstOrThrow({ where: { workspaceId, action: "member.role_changed" }, orderBy: { createdAt: "desc" } });
      expect(audit).toMatchObject({ before: { role: "GUEST" }, after: { role: "MEMBER" } });
      expect(await code(workspaces.changeMemberRole(outsider, { workspaceId, userId: guest.user.id, role: "GUEST" }))).toBe(NOT_FOUND);
    });

    it("never leaves a workspace without an owner, even for a stale owner viewer", async () => {
      // A viewer that still believes it is OWNER (e.g. demoted moments ago) tries to demote the sole real owner.
      const stale: Viewer = { ...member, workspaces: member.workspaces.map((w) => (w.id === workspaceId ? { ...w, actor: { ...w.actor, role: "OWNER" as const } } : w)) };
      expect(await code(workspaces.changeMemberRole(stale, { workspaceId, userId: owner.user.id, role: "ADMIN" }))).toBe("lastOwner");
      expect((await db.membership.findFirstOrThrow({ where: { workspaceId, userId: owner.user.id } })).role).toBe("OWNER");
    });
  });

  describe("checklist", () => {
    it("editors add and toggle items; others can't touch them", async () => {
      const { id } = await tasks.createTaskFromQuickAdd(owner, { input: "Pack for trip", clientMutationId: randomUUID(), context: "personal", projectId: null, view: null });
      await tasks.addChecklistItem(owner, id, "Passport");
      const item = await db.checklistItem.findFirstOrThrow({ where: { taskId: id } });
      await tasks.toggleChecklistItem(owner, item.id, true);
      expect((await db.checklistItem.findUniqueOrThrow({ where: { id: item.id } })).isDone).toBe(true);
      expect(await code(tasks.toggleChecklistItem(member, item.id, false))).toBe(NOT_FOUND);
      expect(await code(tasks.addChecklistItem(outsider, id, "Sneaky"))).toBe(NOT_FOUND);
    });
  });

  describe("auth service", () => {
    it("registers once per email and authenticates with one generic failure", async () => {
      const email = `auth-${f.run}@test.local`;
      const { userId } = await auth.registerUser({ name: "Auth", email, password: "correct horse battery", timezone: "Nowhere/Invalid", locale: "fa" });
      f.userIds.push(userId);
      const row = await db.user.findUniqueOrThrow({ where: { id: userId } });
      expect(row).toMatchObject({ timezone: "UTC", locale: "fa" }); // invalid tz falls back; locale kept
      expect(await code(auth.registerUser({ name: "Again", email, password: "another password!", locale: "en" }))).toBe("emailTaken");
      expect((await auth.authenticate({ email, password: "correct horse battery" })).userId).toBe(userId);
      expect(await code(auth.authenticate({ email, password: "wrong password" }))).toBe("invalidCredentials");
      expect(await code(auth.authenticate({ email: `nobody-${f.run}@test.local`, password: "whatever" }))).toBe("invalidCredentials");
      await db.user.update({ where: { id: userId }, data: { deactivatedAt: new Date() } });
      expect(await code(auth.authenticate({ email, password: "correct horse battery" }))).toBe("invalidCredentials");
    });
  });
});

