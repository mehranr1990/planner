import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NOT_FOUND } from "@/lib/action-result";
import { db } from "@/server/db";
import type { Viewer } from "@/server/context";
import { mentionToken } from "@/features/collaboration/domain/mentions";
import { getMentionCandidates, listTaskComments } from "@/features/collaboration/server/queries";
import * as collab from "@/features/collaboration/server/service";
import * as tasks from "@/features/tasks/server/service";
import { fixtureRun, hasDatabase } from "./helpers";

const suite = hasDatabase ? describe : describe.skip;
const f = fixtureRun();

let alice: Viewer; // OWNER
let bob: Viewer; // MEMBER — visible via the shared (workspace-visibility) project
let carol: Viewer; // MEMBER — visible the same way, uninvolved in any one test's task
let manager: Viewer; // MANAGER — has tasks.delete, used for moderated-delete
let outsider: Viewer; // not a member of the workspace at all
let workspaceId: string;
/** Workspace-visibility project: any non-guest member can see (and so may be @mentioned on) its tasks. */
let sharedProjectId: string;
/** Private project: only its members (here, just alice) can see its tasks. */
let privateProjectId: string;

const quick = (viewer: Viewer, input: string, context = "personal", projectId: string | null = null) =>
  tasks.createTaskFromQuickAdd(viewer, { input, clientMutationId: randomUUID(), context, projectId, view: null });

const mentionsOf = (commentId: string) => db.mention.findMany({ where: { commentId }, select: { mentionedId: true } });
/** Scoped to one task: suite-wide users accumulate notifications across tests, so a bare recipient+type count would leak between tests. */
const mentionNotificationsFor = (userId: string, taskId: string) => db.notification.findMany({ where: { recipientId: userId, type: "MENTIONED", entityId: taskId } });
const commentedNotificationsFor = (userId: string, taskId: string) => db.notification.findMany({ where: { recipientId: userId, type: "TASK_COMMENTED", entityId: taskId } });

suite("comments & mentions (integration)", () => {
  beforeAll(async () => {
    const [a, b, c, m, o] = await Promise.all([
      f.makeUser("alice"),
      f.makeUser("bob"),
      f.makeUser("carol"),
      f.makeUser("manager"),
      f.makeUser("outsider"),
    ]);
    const ws = await f.makeWorkspace(a.id, [
      { userId: b.id, role: "MEMBER" },
      { userId: c.id, role: "MEMBER" },
      { userId: m.id, role: "MANAGER" },
    ]);
    workspaceId = ws.id;
    const [shared, priv] = await Promise.all([
      db.project.create({
        data: { scope: "WORKSPACE", workspaceId, ownerId: a.id, createdById: a.id, name: "Shared", visibility: "WORKSPACE", members: { create: { userId: a.id, role: "LEAD" } } },
      }),
      db.project.create({
        data: { scope: "WORKSPACE", workspaceId, ownerId: a.id, createdById: a.id, name: "Private", visibility: "PRIVATE", members: { create: { userId: a.id, role: "LEAD" } } },
      }),
    ]);
    sharedProjectId = shared.id;
    privateProjectId = priv.id;
    [alice, bob, carol, manager, outsider] = await Promise.all([f.viewerFor(a.id), f.viewerFor(b.id), f.viewerFor(c.id), f.viewerFor(m.id), f.viewerFor(o.id)]);
  });

  afterAll(() => f.cleanup());

  describe("comment CRUD & permissions", () => {
    it("creates a comment, visible to anyone who can see the task, with author and timestamps", async () => {
      const { id: taskId } = await quick(alice, "Discuss this", "personal", sharedProjectId);
      const created = await collab.createComment(alice, taskId, "First note", null);
      const list = await listTaskComments(bob, taskId);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ id: created.id, body: "First note", author: { id: alice.user.id }, editedAt: null, deletedAt: null });
    });

    it("refuses to comment on a task the viewer cannot see", async () => {
      const { id: taskId } = await quick(alice, "Alice's own errand");
      await expect(collab.createComment(bob, taskId, "Sneaky", null)).rejects.toThrow(NOT_FOUND);
    });

    it("lets only the author edit their own comment", async () => {
      const { id: taskId } = await quick(alice, "Editable", "personal", sharedProjectId);
      const c = await collab.createComment(alice, taskId, "Original", null);
      await expect(collab.updateComment(bob, c.id, "Hijacked")).rejects.toThrow(NOT_FOUND); // bob can see it, but isn't the author
      await collab.updateComment(alice, c.id, "Edited");
      const [row] = await listTaskComments(alice, taskId);
      expect(row).toMatchObject({ body: "Edited" });
      expect(row!.editedAt).not.toBeNull();
    });

    it("lets the author delete their own comment, hiding its body", async () => {
      const { id: taskId } = await quick(alice, "Deletable by author", "personal", sharedProjectId);
      const c = await collab.createComment(bob, taskId, "Bob's comment", null);
      await collab.deleteComment(bob, c.id);
      const [row] = await listTaskComments(alice, taskId);
      expect(row).toMatchObject({ body: null, canEdit: false, canDelete: false });
      expect(row!.deletedAt).not.toBeNull();
    });

    it("refuses deletion from a plain member who isn't the author, but allows a manager (tasks.delete) to moderate", async () => {
      const { id: taskId } = await quick(alice, "Moderated", "personal", sharedProjectId);
      const c = await collab.createComment(bob, taskId, "Needs moderation", null);
      await expect(collab.deleteComment(carol, c.id)).rejects.toThrow(NOT_FOUND);
      await collab.deleteComment(manager, c.id);
      const [row] = await listTaskComments(alice, taskId);
      expect(row!.deletedAt).not.toBeNull();
    });

    it("allows one level of replies but rejects replying to a reply", async () => {
      const { id: taskId } = await quick(alice, "Threaded", "personal", sharedProjectId);
      const root = await collab.createComment(alice, taskId, "Root", null);
      const reply = await collab.createComment(bob, taskId, "A reply", root.id);
      const list = await listTaskComments(alice, taskId);
      expect(list.find((c) => c.id === reply.id)?.replyToId).toBe(root.id);
      await expect(collab.createComment(alice, taskId, "Too deep", reply.id)).rejects.toThrow("commentThreadTooDeep");
    });
  });

  describe("mention visibility & notifications", () => {
    it("notifies a mentioned workspace member and excludes them from being over-suggested on a private task", async () => {
      const { id: taskId } = await quick(alice, "Private task", "personal", privateProjectId);
      // carol isn't a member of the private project, so she isn't a mention candidate for it.
      const candidates = (await getMentionCandidates(alice, taskId)).map((u) => u.id);
      expect(candidates).toContain(alice.user.id);
      expect(candidates).not.toContain(carol.user.id);
    });

    it("includes any active workspace member as a mention candidate on a workspace-visible task, but not on a project-less one", async () => {
      const { id: openTaskId } = await quick(alice, "Open task", "personal", sharedProjectId);
      const openCandidates = (await getMentionCandidates(alice, openTaskId)).map((u) => u.id);
      expect(openCandidates).toEqual(expect.arrayContaining([alice.user.id, bob.user.id, carol.user.id]));

      // A bare task with no project is visible only to explicit participants and tasks.view_all holders
      // (manager has that capability by default) — a plain member like bob or carol is excluded.
      const { id: bareTaskId } = await quick(alice, "No project at all", workspaceId);
      const bareCandidates = (await getMentionCandidates(alice, bareTaskId)).map((u) => u.id);
      expect(bareCandidates.sort()).toEqual([alice.user.id, manager.user.id].sort());
    });

    it("creates a notification for a valid mention, never for a self-mention", async () => {
      const { id: taskId } = await quick(alice, "Mention target", "personal", sharedProjectId);
      const body = `Hey ${mentionToken("Bob", bob.user.id)} and ${mentionToken("Alice", alice.user.id)}, look at this`;
      const c = await collab.createComment(alice, taskId, body, null);

      const mentions = await mentionsOf(c.id);
      expect(mentions.map((m) => m.mentionedId)).toEqual([bob.user.id]); // self-mention dropped entirely

      expect(await mentionNotificationsFor(bob.user.id, taskId)).toHaveLength(1);
      expect(await mentionNotificationsFor(alice.user.id, taskId)).toHaveLength(0);
    });

    it("dedupes a user mentioned twice in the same comment into one Mention row and one notification", async () => {
      const { id: taskId } = await quick(alice, "Double mention", "personal", sharedProjectId);
      const token = mentionToken("Bob", bob.user.id);
      const c = await collab.createComment(alice, taskId, `${token} please see this, ${token} really`, null);
      expect(await mentionsOf(c.id)).toHaveLength(1);
      expect(await mentionNotificationsFor(bob.user.id, taskId)).toHaveLength(1);
    });

    it("drops a mention of a user who cannot access the task, without erroring", async () => {
      const { id: taskId } = await quick(alice, "Outsider mention", "personal", sharedProjectId);
      const body = `cc ${mentionToken("Outsider", outsider.user.id)}`;
      const c = await collab.createComment(alice, taskId, body, null);
      expect(await mentionsOf(c.id)).toHaveLength(0);
      expect(await mentionNotificationsFor(outsider.user.id, taskId)).toHaveLength(0);
      const [row] = await listTaskComments(alice, taskId);
      expect(row!.body).toBe(body); // the text itself is preserved as typed
    });

    it("on edit, notifies only newly-added mentions and removes the Mention row for ones taken out", async () => {
      const { id: taskId } = await quick(alice, "Edited mentions", "personal", sharedProjectId);
      const c = await collab.createComment(alice, taskId, `Hi ${mentionToken("Bob", bob.user.id)}`, null);
      expect(await mentionNotificationsFor(bob.user.id, taskId)).toHaveLength(1);

      // Re-saving with the same mention must not notify Bob a second time.
      await collab.updateComment(alice, c.id, `Hi again ${mentionToken("Bob", bob.user.id)}`);
      expect(await mentionNotificationsFor(bob.user.id, taskId)).toHaveLength(1);

      // Swapping the mention to Carol: Carol gets notified, Bob's Mention row is gone.
      await collab.updateComment(alice, c.id, `Actually ${mentionToken("Carol", carol.user.id)}`);
      expect(await mentionsOf(c.id)).toEqual([{ mentionedId: carol.user.id }]);
      expect(await mentionNotificationsFor(carol.user.id, taskId)).toHaveLength(1);
      expect(await mentionNotificationsFor(bob.user.id, taskId)).toHaveLength(1); // unchanged
    });
  });

  describe("Phase 3 batch 3: comment watcher notifications", () => {
    it("notifies the task's other watchers of a new comment, but never the author, and never on top of a mention", async () => {
      const { id: taskId } = await quick(alice, "Commented and watched", "personal", sharedProjectId);
      await tasks.watchTask(bob, taskId);
      await tasks.watchTask(carol, taskId);

      const body = `Heads up ${mentionToken("Carol", carol.user.id)}`;
      await collab.createComment(alice, taskId, body, null);

      expect(await commentedNotificationsFor(bob.user.id, taskId)).toHaveLength(1); // plain watcher
      expect(await commentedNotificationsFor(carol.user.id, taskId)).toHaveLength(0); // mentioned instead — no duplicate ping
      expect(await mentionNotificationsFor(carol.user.id, taskId)).toHaveLength(1);
      expect(await commentedNotificationsFor(alice.user.id, taskId)).toHaveLength(0); // author excluded
    });
  });
});
