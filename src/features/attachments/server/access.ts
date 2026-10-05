import "server-only";
import { db } from "@/server/db";
import type { Viewer } from "@/server/context";
import { canDeleteTask, canEditTask, findVisibleTask, type TaskPolicyRecord } from "@/features/tasks/server/access";

// Attachments have no capability or role of their own — access always follows the parent task
// (§39: "access follows the parent resource"), the same precedent milestones/board columns follow
// for projects. Visibility: anyone who can see the task can see (and download) its attachments.

export interface AttachmentPolicyRecord {
  id: string;
  taskId: string;
  uploadedById: string;
  deletedAt: Date | null;
}

/** Loads an attachment the viewer may act on — its task must still be visible to them. Also the
 * single gate a soft-deleted *task* falls through: `findVisibleTask` already excludes tasks with
 * `deletedAt` set, so an attachment on a soft-deleted task becomes unreachable here too (and
 * reachable again automatically once the task is restored) — no separate check needed. */
export async function loadVisibleAttachment(viewer: Viewer, attachmentId: string): Promise<{ attachment: AttachmentPolicyRecord; task: TaskPolicyRecord } | null> {
  const attachment = await db.attachment.findUnique({
    where: { id: attachmentId },
    select: { id: true, taskId: true, uploadedById: true, deletedAt: true },
  });
  if (!attachment || attachment.deletedAt) return null;
  const task = await findVisibleTask(viewer, attachment.taskId);
  if (!task) return null;
  return { attachment, task };
}

/** Anyone who can edit the task may attach files to it — the same gate the checklist/subtasks use. */
export function canUploadAttachment(viewer: Viewer, task: TaskPolicyRecord): boolean {
  return canEditTask(viewer, task);
}

/** Uploader, or the same elevated role that may delete the task — mirrors Comment's delete rule
 * (`authorId === viewer.user.id || canDeleteTask(viewer, task)`) exactly. */
export function canDeleteAttachment(viewer: Viewer, task: TaskPolicyRecord, attachment: Pick<AttachmentPolicyRecord, "uploadedById">): boolean {
  return attachment.uploadedById === viewer.user.id || canDeleteTask(viewer, task);
}
