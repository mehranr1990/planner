// Client-safe task shapes. Server code maps Prisma rows into these; client components import
// only from here, never from the generated Prisma client.

import type { CalendarDate } from "@/lib/time";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
export type TaskPriority = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export const OPEN_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED"] as const satisfies readonly TaskStatus[];

export interface PersonRef {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface LabelRef {
  id: string;
  name: string;
  color: string;
}

export interface TaskListItem {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  isAllDay: boolean;
  startOn: CalendarDate | null;
  dueOn: CalendarDate | null;
  /** ISO instant for timed tasks. */
  dueAt: string | null;
  isSomeday: boolean;
  /** Computed on the server at request time (date before today, or due time passed). */
  isOverdue: boolean;
  isRecurring: boolean;
  completedAt: string | null;
  version: number;
  context: { kind: "personal" } | { kind: "workspace"; id: string; name: string };
  project: { id: string; name: string; color: string } | null;
  /** Board column (Batch 5); `null` is the unsectioned column. Only meaningful when `project` is set. */
  sectionId: string | null;
  milestoneId: string | null;
  /** Preview (up to 4); `assigneeCount` is the real total for "+N". */
  assignees: PersonRef[];
  assigneeCount: number;
  subtaskCount: number;
  checklist: { done: number; total: number };
  labels: LabelRef[];
  canEdit: boolean;
}

export type RecurrencePreset = "none" | "daily" | "weekdays" | "weekly" | "monthly" | "yearly";
/** Read-only label for series created with options the preset picker cannot express. */
export type RecurrenceDisplay = RecurrencePreset | "custom";

export interface TaskDependencyRef {
  id: string;
  title: string;
  status: TaskStatus;
}

export interface TaskDetail extends TaskListItem {
  description: string | null;
  estimateMinutes: number | null;
  recurrence: { preset: RecurrenceDisplay; mode: "FIXED_SCHEDULE" | "AFTER_COMPLETION" } | null;
  /** Minutes after local midnight in the viewer's timezone, for the edit form. */
  dueTime: number | null;
  startTime: number | null;
  createdAt: string;
  createdBy: PersonRef;
  canDelete: boolean;
  canAssign: boolean;
  subtasks: { id: string; title: string; status: TaskStatus; canEdit: boolean }[];
  checklistItems: { id: string; title: string; isDone: boolean }[];
  attachments: { id: string; filename: string; mimeType: string; size: number; createdAt: string; uploadedBy: PersonRef; canDelete: boolean }[];
  activity: { id: string; action: string; actor: PersonRef | null; createdAt: string }[];
  isWatching: boolean;
  watcherCount: number;
  /** Tasks that must finish before this one can start. */
  blockedBy: TaskDependencyRef[];
  /** Tasks this one blocks. */
  blocking: TaskDependencyRef[];
  /** True when any `blockedBy` task is still open — drives the blocked-state indicator. */
  isBlocked: boolean;
}
