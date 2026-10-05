import "server-only";
import { randomUUID } from "node:crypto";
import { NOT_FOUND } from "@/lib/action-result";
import { recordActivity } from "@/server/activity";
import { db } from "@/server/db";
import { DomainError } from "@/server/errors";
import { storageProvider } from "@/server/storage";
import type { Viewer } from "@/server/context";
import { findVisibleTask } from "@/features/tasks/server/access";
import { sanitizeFilename, validateAttachment } from "../domain/validation";
import { canDeleteAttachment, canUploadAttachment, loadVisibleAttachment } from "./access";
import type { AttachmentItem } from "../types";

// Attachments (Batch 6, Vercel Blob). Metadata lives in `Attachment`; the bytes live in a private
// Blob store behind `src/server/storage` — see that module and docs/HANDOFF.md for the full
// upload/download/lifecycle design (orphan handling, soft-delete-follows-task, validation limits).

type AttachmentRow = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  uploadedBy: { id: string; name: string; avatarUrl: string | null };
};

function toAttachmentItem(row: AttachmentRow, canDelete: boolean): AttachmentItem {
  return { id: row.id, filename: row.filename, mimeType: row.mimeType, size: row.size, createdAt: row.createdAt.toISOString(), uploadedBy: row.uploadedBy, canDelete };
}

const attachmentSelect = { id: true, filename: true, mimeType: true, size: true, createdAt: true, uploadedBy: { select: { id: true, name: true, avatarUrl: true } } } as const;

export async function uploadAttachment(viewer: Viewer, taskId: string, file: File): Promise<AttachmentItem> {
  const task = await findVisibleTask(viewer, taskId);
  if (!task || !canUploadAttachment(viewer, task)) throw new DomainError(NOT_FOUND);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const filename = sanitizeFilename(file.name || "file");
  const mimeType = file.type || "application/octet-stream";
  const validationError = validateAttachment({ filename, mimeType, size: file.size, bytes });
  if (validationError) throw new DomainError(validationError);

  const pathname = `tasks/${taskId}/${randomUUID()}-${filename}`;
  const stored = await storageProvider.upload({ pathname, body: bytes, contentType: mimeType });

  try {
    const row = await db.$transaction(async (tx) => {
      const created = await tx.attachment.create({
        data: { taskId, workspaceId: task.workspaceId, uploadedById: viewer.user.id, filename, mimeType, size: stored.size, storageKey: stored.storageKey },
        select: attachmentSelect,
      });
      await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: taskId, action: "attachment_added", data: { attachmentId: created.id, filename } });
      return created;
    });
    return toAttachmentItem(row, true);
  } catch (e) {
    // The Blob upload already succeeded; a failed DB write must not leave an orphaned object with
    // no metadata row pointing at it — compensating cleanup, not a distributed transaction.
    await storageProvider.remove(stored.storageKey).catch(() => undefined);
    throw e;
  }
}

export async function removeAttachment(viewer: Viewer, attachmentId: string): Promise<void> {
  const loaded = await loadVisibleAttachment(viewer, attachmentId);
  if (!loaded) throw new DomainError(NOT_FOUND);
  const { attachment, task } = loaded;
  if (!canDeleteAttachment(viewer, task, attachment)) throw new DomainError(NOT_FOUND);

  const full = await db.attachment.findUniqueOrThrow({ where: { id: attachmentId }, select: { storageKey: true, filename: true } });
  await db.$transaction(async (tx) => {
    await tx.attachment.update({ where: { id: attachmentId }, data: { deletedAt: new Date() } });
    await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: attachment.taskId, action: "attachment_removed", data: { attachmentId, filename: full.filename } });
  });
  // Best-effort: the DB row (the source of truth for "does this attachment exist") is already
  // gone; a failed Blob delete here leaves an orphaned object, never a half-removed attachment.
  await storageProvider.remove(full.storageKey).catch((e: unknown) => {
    console.error(`[attachments] failed to remove blob ${full.storageKey} for attachment ${attachmentId}`, e);
  });
}

/** Used only by the authenticated download route (src/app/api/attachments/[attachmentId]/route.ts)
 * — returns `null` for "not found or not visible," never throws, so the route can map it to a
 * plain 404 without leaking which case applied. */
export async function downloadAttachment(viewer: Viewer, attachmentId: string) {
  const loaded = await loadVisibleAttachment(viewer, attachmentId);
  if (!loaded) return null;
  const full = await db.attachment.findUniqueOrThrow({ where: { id: attachmentId }, select: { storageKey: true, filename: true, mimeType: true } });
  const download = await storageProvider.download(full.storageKey);
  if (!download) return null;
  return { stream: download.stream, filename: full.filename, mimeType: full.mimeType };
}
