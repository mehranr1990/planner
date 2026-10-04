import "server-only";
import { NOT_FOUND } from "@/lib/action-result";
import { db } from "@/server/db";
import { DomainError } from "@/server/errors";
import { recordActivity } from "@/server/activity";
import { notify, notifyMany } from "@/server/notifications";
import type { Viewer } from "@/server/context";
import { canDeleteTask, findVisibleTask, taskNotifiableRecipients, type TaskPolicyRecord } from "@/features/tasks/server/access";
import { parseMentions } from "../domain/mentions";
import { loadVisibleComment, mentionCandidateIds } from "./access";

export { DomainError };

async function loadCommentableTask(viewer: Viewer, taskId: string): Promise<TaskPolicyRecord> {
  const task = await findVisibleTask(viewer, taskId);
  if (!task) throw new DomainError(NOT_FOUND);
  return task;
}

/** Mentions in `body` that resolve to a real, task-visible user, excluding the author (never self-notify). */
async function resolveMentions(viewer: Viewer, task: TaskPolicyRecord, body: string) {
  const candidates = await mentionCandidateIds(task);
  return parseMentions(body).filter((m) => m.userId !== viewer.user.id && candidates.has(m.userId));
}

export async function createComment(viewer: Viewer, taskId: string, body: string, replyToId: string | null) {
  const task = await loadCommentableTask(viewer, taskId);

  if (replyToId) {
    const parent = await db.comment.findUnique({ where: { id: replyToId }, select: { taskId: true, replyToId: true, deletedAt: true } });
    if (!parent || parent.taskId !== taskId || parent.deletedAt) throw new DomainError(NOT_FOUND);
    if (parent.replyToId) throw new DomainError("commentThreadTooDeep"); // one level of threading only
  }

  const mentions = await resolveMentions(viewer, task, body);

  return db.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: { workspaceId: task.workspaceId, authorId: viewer.user.id, taskId, replyToId, body },
      select: { id: true },
    });
    if (mentions.length > 0) {
      await tx.mention.createMany({ data: mentions.map((m) => ({ commentId: comment.id, mentionedId: m.userId })), skipDuplicates: true });
    }
    await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: taskId, action: "comment_created", data: { commentId: comment.id } });
    const mentionedIds = new Set(mentions.map((m) => m.userId));
    for (const m of mentions) {
      await notify(tx, {
        recipientId: m.userId,
        workspaceId: task.workspaceId,
        actorId: viewer.user.id,
        type: "MENTIONED",
        entityType: "task",
        entityId: taskId,
        title: task.title,
        deepLink: `/planner/all?task=${taskId}`,
        dedupeKey: `comment:${comment.id}:mentioned:${m.userId}`,
      });
    }
    // Watcher policy: notify the rest of the task's stakeholders about the new comment too —
    // but never on top of a MENTIONED notification for this same comment (no duplicate pings).
    const watcherRecipients = taskNotifiableRecipients(task, viewer.user.id).filter((id) => !mentionedIds.has(id));
    await notifyMany(tx, watcherRecipients, {
      workspaceId: task.workspaceId,
      actorId: viewer.user.id,
      type: "TASK_COMMENTED",
      entityType: "task",
      entityId: taskId,
      title: task.title,
      deepLink: `/planner/all?task=${taskId}`,
      dedupeKeyFor: (userId) => `comment:${comment.id}:commented:${userId}`,
    });
    return comment;
  });
}

export async function updateComment(viewer: Viewer, commentId: string, body: string) {
  const loaded = await loadVisibleComment(viewer, commentId);
  if (!loaded || loaded.comment.deletedAt) throw new DomainError(NOT_FOUND);
  const { comment, task } = loaded;
  if (comment.authorId !== viewer.user.id) throw new DomainError(NOT_FOUND); // edit is author-only, never moderated

  const nextMentions = await resolveMentions(viewer, task, body);
  const nextIds = new Set(nextMentions.map((m) => m.userId));
  const existing = await db.mention.findMany({ where: { commentId }, select: { mentionedId: true } });
  const existingIds = new Set(existing.map((m) => m.mentionedId));
  const added = nextMentions.filter((m) => !existingIds.has(m.userId));
  const removedIds = [...existingIds].filter((id) => !nextIds.has(id));

  await db.$transaction(async (tx) => {
    await tx.comment.update({ where: { id: commentId }, data: { body, editedAt: new Date() } });
    if (removedIds.length > 0) await tx.mention.deleteMany({ where: { commentId, mentionedId: { in: removedIds } } });
    if (added.length > 0) await tx.mention.createMany({ data: added.map((m) => ({ commentId, mentionedId: m.userId })), skipDuplicates: true });
    await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: comment.taskId!, action: "comment_edited", data: { commentId } });
    // Only the newly-added mentions notify — mentions already present before the edit don't re-fire.
    for (const m of added) {
      await notify(tx, {
        recipientId: m.userId,
        workspaceId: task.workspaceId,
        actorId: viewer.user.id,
        type: "MENTIONED",
        entityType: "task",
        entityId: comment.taskId!,
        title: task.title,
        deepLink: `/planner/all?task=${comment.taskId}`,
        dedupeKey: `comment:${commentId}:mentioned:${m.userId}`,
      });
    }
  });
}

export async function deleteComment(viewer: Viewer, commentId: string) {
  const loaded = await loadVisibleComment(viewer, commentId);
  if (!loaded || loaded.comment.deletedAt) throw new DomainError(NOT_FOUND);
  const { comment, task } = loaded;
  const allowed = comment.authorId === viewer.user.id || canDeleteTask(viewer, task); // self, or the same elevated role that may delete the task
  if (!allowed) throw new DomainError(NOT_FOUND);

  await db.$transaction(async (tx) => {
    await tx.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
    await recordActivity(tx, { workspaceId: task.workspaceId, actorId: viewer.user.id, entityType: "task", entityId: comment.taskId!, action: "comment_deleted", data: { commentId } });
  });
}
