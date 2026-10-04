import "server-only";
import { db } from "@/server/db";
import type { Viewer } from "@/server/context";
import { can, type WorkspaceActor } from "@/server/permissions/capabilities";
import { findVisibleTask, type TaskPolicyRecord } from "@/features/tasks/server/access";

export { findVisibleTask };
export type { TaskPolicyRecord };

/**
 * Users allowed to see `task` — the audience a @mention may target. Mirrors `visibleTasksWhere`'s
 * rules (owner/creator/assignee/watcher/project-member/view_all/non-guest-workspace-visible-project)
 * without re-deriving them per task: explicit participants are always included, then the broader
 * workspace rule is applied per member.
 */
export async function mentionCandidateIds(task: TaskPolicyRecord): Promise<Set<string>> {
  const watchers = await db.taskWatcher.findMany({ where: { taskId: task.id }, select: { userId: true } });

  if (task.scope === "PERSONAL") {
    return new Set([task.ownerId, ...task.assignees.map((a) => a.userId), ...watchers.map((w) => w.userId)]);
  }

  const workspaceId = task.workspaceId!;
  const members = await db.membership.findMany({
    where: { workspaceId, status: "ACTIVE" },
    select: { userId: true, role: true, customRole: { select: { capabilities: true } } },
  });
  const explicit = new Set<string>([task.ownerId, task.createdById, ...task.assignees.map((a) => a.userId), ...watchers.map((w) => w.userId)]);
  const projectMemberIds = new Set((task.project?.members ?? []).map((m) => m.userId));
  const isPrivateProject = task.project?.visibility === "PRIVATE";

  const ids = new Set<string>();
  for (const m of members) {
    if (explicit.has(m.userId)) {
      ids.add(m.userId);
      continue;
    }
    const actor: WorkspaceActor = { userId: m.userId, workspaceId, role: m.role, customCapabilities: m.customRole?.capabilities ?? null, active: true };
    if (can(actor, "tasks.view_all")) {
      ids.add(m.userId);
      continue;
    }
    // Mirrors visibleTasksWhere: with no project at all, only explicit participants / view_all see
    // the task — "non-guest member" only grants access via a project whose visibility is WORKSPACE.
    if (!task.project) continue;
    if (m.role === "GUEST" || isPrivateProject) {
      if (projectMemberIds.has(m.userId)) ids.add(m.userId);
    } else {
      ids.add(m.userId);
    }
  }
  return ids;
}

export interface CommentPolicyRecord {
  id: string;
  taskId: string | null;
  authorId: string;
  replyToId: string | null;
  deletedAt: Date | null;
}

/** Loads a comment the viewer may act on (its task must still be visible to them). */
export async function loadVisibleComment(viewer: Viewer, commentId: string): Promise<{ comment: CommentPolicyRecord; task: TaskPolicyRecord } | null> {
  const comment = await db.comment.findUnique({
    where: { id: commentId },
    select: { id: true, taskId: true, authorId: true, replyToId: true, deletedAt: true },
  });
  if (!comment || !comment.taskId) return null;
  const task = await findVisibleTask(viewer, comment.taskId);
  if (!task) return null;
  return { comment, task };
}
