import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { storageProvider } from "@/server/storage";
import type { Viewer } from "@/server/context";
import * as accountService from "@/features/account/server/service";
import * as attachments from "@/features/attachments/server/service";
import * as sections from "@/features/projects/server/sections";
import { getTaskDetail } from "@/features/tasks/server/queries";
import * as tasks from "@/features/tasks/server/service";
import * as workspaceService from "@/features/workspace/server/service";
import { hasDatabase, fixtureRun } from "./helpers";

// Storage abstraction, exercised directly (no database needed): outside production without Blob
// credentials, `storageProvider` resolves to the in-memory dev/test adapter — see src/server/
// storage/index.ts. These assertions hold regardless of which adapter is active.
describe("storage provider (unit)", () => {
  it("round-trips an uploaded object", async () => {
    const body = new TextEncoder().encode("hello storage");
    const stored = await storageProvider.upload({ pathname: "test/round-trip", body, contentType: "text/plain" });
    const download = await storageProvider.download(stored.storageKey);
    expect(download).not.toBeNull();
    expect(download!.contentType).toBe("text/plain");
    const bytes = new Uint8Array(await new Response(download!.stream).arrayBuffer());
    expect(new TextDecoder().decode(bytes)).toBe("hello storage");
  });

  it("download returns null for a key that was never uploaded", async () => {
    expect(await storageProvider.download("does/not/exist")).toBeNull();
  });

  it("remove is idempotent: removing an already-missing object does not throw", async () => {
    const stored = await storageProvider.upload({ pathname: "test/removable", body: new Uint8Array([1, 2, 3]), contentType: "application/octet-stream" });
    await storageProvider.remove(stored.storageKey);
    expect(await storageProvider.download(stored.storageKey)).toBeNull();
    await expect(storageProvider.remove(stored.storageKey)).resolves.toBeUndefined(); // second remove: no-op, not an error
  });
});

// Batch 6 (final Phase 3 batch): task attachments (Vercel Blob — exercised here against the
// in-memory dev/test storage adapter, see src/server/storage/memory.ts), avatar upload, workspace
// ownership transfer, and the Batch 5 board-section rename/archive carry-over (UI only — the
// service layer itself was already covered by batch5.integration.test.ts's archive cases; this
// file adds the one gap, `renameSection`'s permission behavior).
const suite = hasDatabase ? describe : describe.skip;

const TZ = "Asia/Tehran";

const quick = (viewer: Viewer, input: string, context = "personal", extra: Partial<{ projectId: string }> = {}) =>
  tasks.createTaskFromQuickAdd(viewer, { input, clientMutationId: randomUUID(), context, projectId: extra.projectId ?? null, view: null });

function makeFile(name: string, mimeType: string, bytes: Uint8Array): File {
  return new File([Buffer.from(bytes)], name, { type: mimeType });
}

const text = (s: string) => new TextEncoder().encode(s);

suite("Batch 6: attachments, avatar, ownership transfer (integration)", () => {
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
      data: { scope: "WORKSPACE", workspaceId, ownerId: a.id, createdById: a.id, name: "Batch6 Project", visibility: "PRIVATE", members: { create: { userId: a.id, role: "LEAD" } } },
    });
    projectId = project.id;
    [alice, bob, outsider] = await Promise.all([fixture.viewerFor(a.id), fixture.viewerFor(b.id), fixture.viewerFor(o.id)]);
  });

  afterAll(fixture.cleanup);

  describe("attachments", () => {
    it("uploads a file, stores metadata (not just a Blob URL), and records activity", async () => {
      const { id: taskId } = await quick(alice, "task with file", workspaceId);
      const item = await attachments.uploadAttachment(alice, taskId, makeFile("notes.txt", "text/plain", text("hello world")));
      expect(item.filename).toBe("notes.txt");
      expect(item.mimeType).toBe("text/plain");
      expect(item.canDelete).toBe(true);

      const row = await db.attachment.findUniqueOrThrow({ where: { id: item.id } });
      expect(row.taskId).toBe(taskId);
      expect(row.uploadedById).toBe(alice.user.id);
      expect(row.workspaceId).toBe(workspaceId);
      expect(row.storageKey).toBeTruthy();
      expect(row.size).toBe(text("hello world").byteLength);

      const detail = await getTaskDetail(alice, taskId);
      expect(detail!.attachments).toHaveLength(1);
      expect(detail!.attachments[0]!.uploadedBy.id).toBe(alice.user.id);

      const activity = await db.activity.findFirst({ where: { entityType: "task", entityId: taskId, action: "attachment_added" } });
      expect(activity).not.toBeNull();
      expect((activity!.data as { filename: string }).filename).toBe("notes.txt");
    });

    it("rejects upload from a user without edit rights on the task", async () => {
      const { id: taskId } = await quick(alice, "personal task", "personal");
      await expect(attachments.uploadAttachment(outsider, taskId, makeFile("x.txt", "text/plain", text("x")))).rejects.toThrow();
    });

    it("rejects cross-workspace access: an outsider can neither see nor download it", async () => {
      const { id: taskId } = await quick(alice, "task", workspaceId);
      const item = await attachments.uploadAttachment(alice, taskId, makeFile("a.txt", "text/plain", text("a")));
      await expect(attachments.removeAttachment(outsider, item.id)).rejects.toThrow();
      expect(await attachments.downloadAttachment(outsider, item.id)).toBeNull();
      expect(await attachments.downloadAttachment(alice, item.id)).not.toBeNull();
    });

    it("rejects an empty file", async () => {
      const { id: taskId } = await quick(alice, "task", workspaceId);
      await expect(attachments.uploadAttachment(alice, taskId, makeFile("empty.txt", "text/plain", new Uint8Array()))).rejects.toThrow();
    });

    it("rejects a file over the size limit", async () => {
      const { id: taskId } = await quick(alice, "task", workspaceId);
      const big = new Uint8Array(21 * 1024 * 1024);
      await expect(attachments.uploadAttachment(alice, taskId, makeFile("big.txt", "text/plain", big))).rejects.toThrow();
    });

    it("rejects a disallowed MIME type", async () => {
      const { id: taskId } = await quick(alice, "task", workspaceId);
      await expect(attachments.uploadAttachment(alice, taskId, makeFile("script.sh", "application/x-sh", text("#!/bin/sh\necho hi")))).rejects.toThrow();
    });

    it("rejects a renamed executable even behind an allowed extension and MIME type", async () => {
      const { id: taskId } = await quick(alice, "task", workspaceId);
      const exeBytes = new Uint8Array([0x4d, 0x5a, 0x00, 0x00, 0x00]); // "MZ" — Windows PE header
      await expect(attachments.uploadAttachment(alice, taskId, makeFile("totally-a-doc.txt", "text/plain", exeBytes))).rejects.toThrow();
    });

    it("delete permission: uploader can remove their own; a non-uploader without delete rights cannot", async () => {
      const { id: taskId } = await quick(alice, "task to delete from", workspaceId);
      const item = await attachments.uploadAttachment(alice, taskId, makeFile("a.txt", "text/plain", text("a")));
      await expect(attachments.removeAttachment(bob, item.id)).rejects.toThrow(); // bob: workspace member, not the uploader, no project/task edit rights here
      await attachments.removeAttachment(alice, item.id);
      const row = await db.attachment.findUniqueOrThrow({ where: { id: item.id } });
      expect(row.deletedAt).not.toBeNull();
      const detail = await getTaskDetail(alice, taskId);
      expect(detail!.attachments).toHaveLength(0);
    });

    it("a second removal attempt on an already-removed attachment fails closed, not a crash", async () => {
      const { id: taskId } = await quick(alice, "task", workspaceId);
      const item = await attachments.uploadAttachment(alice, taskId, makeFile("a.txt", "text/plain", text("a")));
      await attachments.removeAttachment(alice, item.id);
      // The attachment is already soft-deleted, so loadVisibleAttachment no longer finds it.
      await expect(attachments.removeAttachment(alice, item.id)).rejects.toThrow();
    });

    it("task soft-delete hides its attachments; restoring the task makes them visible again", async () => {
      const { id: taskId } = await quick(alice, "soft-delete carries attachments", workspaceId);
      await attachments.uploadAttachment(alice, taskId, makeFile("a.txt", "text/plain", text("a")));
      await tasks.softDeleteTask(alice, taskId);
      expect(await getTaskDetail(alice, taskId)).toBeNull();
      const stillInDb = await db.attachment.findFirst({ where: { taskId, deletedAt: null } });
      expect(stillInDb).not.toBeNull(); // kept, not deleted by the task's own soft-delete
      await tasks.restoreTask(alice, taskId);
      const detail = await getTaskDetail(alice, taskId);
      expect(detail!.attachments).toHaveLength(1);
    });
  });

  describe("avatar upload", () => {
    it("uploads, replaces (cleaning up the previous Blob object), and removes", async () => {
      const first = await accountService.setAvatar(alice, makeFile("me.png", "image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])));
      expect(first.avatarUrl).toBe(`/api/avatars/${alice.user.id}`);
      const row1 = await db.user.findUniqueOrThrow({ where: { id: alice.user.id }, select: { avatarUrl: true, avatarStorageKey: true, avatarMimeType: true } });
      expect(row1.avatarUrl).toBe(`/api/avatars/${alice.user.id}`);
      expect(row1.avatarStorageKey).toBeTruthy();
      expect(row1.avatarMimeType).toBe("image/png");

      await accountService.setAvatar(alice, makeFile("me2.png", "image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 4, 5, 6])));
      const row2 = await db.user.findUniqueOrThrow({ where: { id: alice.user.id }, select: { avatarStorageKey: true } });
      expect(row2.avatarStorageKey).not.toBe(row1.avatarStorageKey); // replaced, not reused
      expect(row2.avatarStorageKey).toBeTruthy();

      await accountService.removeAvatar(alice);
      const row3 = await db.user.findUniqueOrThrow({ where: { id: alice.user.id }, select: { avatarUrl: true, avatarStorageKey: true, avatarMimeType: true } });
      expect(row3.avatarUrl).toBeNull();
      expect(row3.avatarStorageKey).toBeNull();
      expect(row3.avatarMimeType).toBeNull();
    });

    it("removing twice is a harmless no-op (idempotent)", async () => {
      await accountService.removeAvatar(bob); // no avatar set at all yet
      await accountService.setAvatar(bob, makeFile("b.png", "image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47])));
      await accountService.removeAvatar(bob);
      await expect(accountService.removeAvatar(bob)).resolves.toBeUndefined();
    });

    it("rejects an oversized image", async () => {
      const big = new Uint8Array(6 * 1024 * 1024);
      await expect(accountService.setAvatar(bob, makeFile("big.png", "image/png", big))).rejects.toThrow();
    });

    it("rejects a non-image MIME type", async () => {
      await expect(accountService.setAvatar(bob, makeFile("doc.pdf", "application/pdf", text("%PDF-1.4")))).rejects.toThrow();
    });

    it("isolates avatars per user", async () => {
      await accountService.setAvatar(bob, makeFile("bob.png", "image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9])));
      const aliceRow = await db.user.findUniqueOrThrow({ where: { id: alice.user.id }, select: { avatarStorageKey: true } });
      const bobRow = await db.user.findUniqueOrThrow({ where: { id: bob.user.id }, select: { avatarStorageKey: true } });
      expect(aliceRow.avatarStorageKey).not.toBe(bobRow.avatarStorageKey);
    });
  });

  describe("ownership transfer", () => {
    async function freshWorkspace() {
      const owner = await fixture.makeUser(`owner-${randomUUID().slice(0, 6)}`);
      const member = await fixture.makeUser(`member-${randomUUID().slice(0, 6)}`);
      const guestUser = await fixture.makeUser(`guest-${randomUUID().slice(0, 6)}`);
      const ws = await fixture.makeWorkspace(owner.id, [
        { userId: member.id, role: "MEMBER" },
        { userId: guestUser.id, role: "GUEST" },
      ]);
      const [ownerViewer, memberViewer, guestViewer] = await Promise.all([fixture.viewerFor(owner.id), fixture.viewerFor(member.id), fixture.viewerFor(guestUser.id)]);
      return { wsId: ws.id, ownerViewer, memberViewer, guestViewer };
    }

    it("transfers ownership: exactly one owner before and after, previous owner becomes ADMIN", async () => {
      const { wsId, ownerViewer, memberViewer } = await freshWorkspace();
      expect(await db.membership.count({ where: { workspaceId: wsId, role: "OWNER", status: "ACTIVE" } })).toBe(1);

      await workspaceService.transferOwnership(ownerViewer, { workspaceId: wsId, userId: memberViewer.user.id });

      expect(await db.membership.count({ where: { workspaceId: wsId, role: "OWNER", status: "ACTIVE" } })).toBe(1);
      const previousOwner = await db.membership.findUniqueOrThrow({ where: { workspaceId_userId: { workspaceId: wsId, userId: ownerViewer.user.id } } });
      const newOwner = await db.membership.findUniqueOrThrow({ where: { workspaceId_userId: { workspaceId: wsId, userId: memberViewer.user.id } } });
      expect(previousOwner.role).toBe("ADMIN");
      expect(newOwner.role).toBe("OWNER");

      const audit = await db.auditEvent.findFirst({ where: { workspaceId: wsId, action: "workspace.ownership_transferred" } });
      expect(audit).not.toBeNull();
      const notification = await db.notification.findFirst({ where: { workspaceId: wsId, recipientId: memberViewer.user.id, type: "WORKSPACE_OWNERSHIP_TRANSFERRED" } });
      expect(notification).not.toBeNull();
    });

    it("rejects a non-owner attempting to transfer ownership", async () => {
      const { wsId, memberViewer, guestViewer } = await freshWorkspace();
      await expect(workspaceService.transferOwnership(memberViewer, { workspaceId: wsId, userId: guestViewer.user.id })).rejects.toThrow();
    });

    it("rejects transferring to yourself", async () => {
      const { wsId, ownerViewer } = await freshWorkspace();
      await expect(workspaceService.transferOwnership(ownerViewer, { workspaceId: wsId, userId: ownerViewer.user.id })).rejects.toThrow();
    });

    it("rejects transferring to a non-member", async () => {
      const { wsId, ownerViewer } = await freshWorkspace();
      const stranger = await fixture.makeUser(`stranger-${randomUUID().slice(0, 6)}`);
      await expect(workspaceService.transferOwnership(ownerViewer, { workspaceId: wsId, userId: stranger.id })).rejects.toThrow();
    });

    it("rejects transferring to a GUEST member", async () => {
      const { wsId, ownerViewer, guestViewer } = await freshWorkspace();
      await expect(workspaceService.transferOwnership(ownerViewer, { workspaceId: wsId, userId: guestViewer.user.id })).rejects.toThrow();
    });

    it("rejects a cross-workspace target (member of a different workspace)", async () => {
      const first = await freshWorkspace();
      const second = await freshWorkspace();
      // second.memberViewer belongs to `second.wsId`, not `first.wsId` — the actor here is scoped to first.wsId.
      await expect(workspaceService.transferOwnership(first.ownerViewer, { workspaceId: first.wsId, userId: second.memberViewer.user.id })).rejects.toThrow();
    });

    it("permissions refresh correctly: the new owner can now change roles; the previous owner is a regular admin", async () => {
      const { wsId, ownerViewer, memberViewer } = await freshWorkspace();
      await workspaceService.transferOwnership(ownerViewer, { workspaceId: wsId, userId: memberViewer.user.id });
      const refreshedNewOwner = await fixture.viewerFor(memberViewer.user.id);
      const refreshedPreviousOwner = await fixture.viewerFor(ownerViewer.user.id);
      // The new owner can now demote the previous owner (an ADMIN) — proving the capability model
      // picked up the swapped roles, not just the raw DB rows.
      await workspaceService.changeMemberRole(refreshedNewOwner, { workspaceId: wsId, userId: refreshedPreviousOwner.user.id, role: "MEMBER" });
      const demoted = await db.membership.findUniqueOrThrow({ where: { workspaceId_userId: { workspaceId: wsId, userId: ownerViewer.user.id } } });
      expect(demoted.role).toBe("MEMBER");
    });
  });

  describe("board section carry-over (Batch 5 rename/archive, Batch 6 UI)", () => {
    it("rejects renaming a column from someone without project edit rights", async () => {
      const col = await sections.createSection(alice, projectId, "Needs rename");
      await expect(sections.renameSection(bob, col.id, "Nope")).rejects.toThrow();
    });

    it("renames a column for someone with project edit rights", async () => {
      const col = await sections.createSection(alice, projectId, "Old name");
      await sections.renameSection(alice, col.id, "New name");
      const list = await sections.listSections(alice, projectId);
      expect(list.find((s) => s.id === col.id)?.name).toBe("New name");
      const activity = await db.activity.findFirst({ where: { entityType: "project", entityId: projectId, action: "section_renamed" } });
      expect(activity).not.toBeNull();
    });
  });
});
