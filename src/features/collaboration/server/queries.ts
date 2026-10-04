import "server-only";
import { db } from "@/server/db";
import type { Viewer } from "@/server/context";
import type { PersonRef } from "@/components/ui/people";
import { canDeleteTask, findVisibleTask } from "@/features/tasks/server/access";
import type { CommentItem } from "../types";
import { mentionCandidateIds } from "./access";

export async function listTaskComments(viewer: Viewer, taskId: string): Promise<CommentItem[]> {
  const task = await findVisibleTask(viewer, taskId);
  if (!task) return [];
  const canModerate = canDeleteTask(viewer, task);

  const rows = await db.comment.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      replyToId: true,
      authorId: true,
      createdAt: true,
      editedAt: true,
      deletedAt: true,
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
    take: 500,
  });

  return rows.map((r) => ({
    id: r.id,
    body: r.deletedAt ? null : r.body,
    replyToId: r.replyToId,
    author: r.author,
    createdAt: r.createdAt.toISOString(),
    editedAt: r.editedAt?.toISOString() ?? null,
    deletedAt: r.deletedAt?.toISOString() ?? null,
    canEdit: !r.deletedAt && r.authorId === viewer.user.id,
    canDelete: !r.deletedAt && (r.authorId === viewer.user.id || canModerate),
  }));
}

/** Workspace-and-visibility-aware @mention candidates for the open task — never everyone in the workspace by default. */
export async function getMentionCandidates(viewer: Viewer, taskId: string): Promise<PersonRef[]> {
  const task = await findVisibleTask(viewer, taskId);
  if (!task) return [];
  const ids = await mentionCandidateIds(task);
  const users = await db.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, avatarUrl: true } });
  return users.sort((a, b) => a.name.localeCompare(b.name));
}
