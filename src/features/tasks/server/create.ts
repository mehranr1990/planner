import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { toDbDate, type CalendarDate } from "@/lib/time";
import { recordActivity } from "@/server/activity";
import type { Tx } from "@/server/db";
import { DomainError } from "@/server/errors";
import { NOT_FOUND } from "@/lib/action-result";
import type { StoredSchedule } from "../domain/schedule";
import type { TaskPriority } from "../types";

// The single task-creation core (§91). Every source — Quick Add, project, calendar, chat,
// meeting, forms, capture, automation, AI, playbooks, duplicate, recurrence — normalizes its
// own input and then calls `createTask`. Nothing else inserts task rows.
//
// Responsibilities split:
//   caller → authorization (who may create where) and source-specific normalization
//            (parsing, next-occurrence maths, form mapping …)
//   core   → invariants: project-derived scope, idempotency, recurrence uniqueness,
//            assignment/label copying, activity with source metadata — all inside the
//            caller's transaction.

export const TASK_SOURCES = [
  "QUICK_ADD",
  "PROJECT",
  "CALENDAR",
  "CHAT",
  "MEETING",
  "FORM",
  "CAPTURE",
  "AUTOMATION",
  "AI",
  "PLAYBOOK",
  "DUPLICATE",
  "RECURRENCE",
  "SUBTASK",
] as const;
export type TaskSource = (typeof TASK_SOURCES)[number];

export interface NewTaskInput {
  /** Where the task originates; `ref` points at the originating record (message, meeting, task …). */
  source: { kind: TaskSource; ref?: { type: string; id: string } };
  /** Used only when there is no project; with a project, the project's scope always wins. */
  scope: { scope: "PERSONAL" | "WORKSPACE"; workspaceId: string | null };
  ownerId: string;
  createdById: string;
  projectId?: string | null;
  sectionId?: string | null;
  areaId?: string | null;
  parentId?: string | null;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  schedule: StoredSchedule;
  isSomeday?: boolean;
  estimateMinutes?: number | null;
  sortOrder?: number;
  /** Client-generated id for retry/double-submit safety; unique per creator. */
  clientMutationId?: string | null;
  /** Recurrence occurrence key; unique per series. */
  occurrence?: { seriesId: string; occurrenceOn: CalendarDate } | null;
  assignees?: { userId: string; assignedById: string }[];
  labelIds?: string[];
}

export interface CreatedTask {
  id: string;
  /** false when an idempotency key matched an existing task (nothing was written). */
  created: boolean;
}

async function scopeFor(tx: Tx, input: NewTaskInput) {
  if (!input.projectId) {
    const { scope, workspaceId } = input.scope;
    if ((scope === "PERSONAL") !== (workspaceId === null)) throw new Error("createTask: inconsistent scope");
    return { scope, workspaceId };
  }
  // Whether a project accepts new tasks (archived, membership…) is the caller's rule; recurrence,
  // for example, keeps generating inside archived projects as it always has.
  const project = await tx.project.findUnique({ where: { id: input.projectId }, select: { scope: true, workspaceId: true } });
  if (!project) throw new DomainError(NOT_FOUND);
  // The project decides the scope; a caller-supplied context can never move a task elsewhere.
  return { scope: project.scope, workspaceId: project.workspaceId };
}

async function findExisting(tx: Tx, input: NewTaskInput): Promise<string | null> {
  if (input.clientMutationId) {
    const hit = await tx.task.findFirst({ where: { createdById: input.createdById, clientMutationId: input.clientMutationId }, select: { id: true } });
    if (hit) return hit.id;
  }
  if (input.occurrence) {
    const hit = await tx.task.findFirst({
      where: { seriesId: input.occurrence.seriesId, occurrenceOn: toDbDate(input.occurrence.occurrenceOn) },
      select: { id: true },
    });
    if (hit) return hit.id;
  }
  return null;
}

/**
 * Inserts one task. Must run inside a transaction (`db.$transaction(tx => createTask(tx, …))`).
 * Duplicate idempotency keys resolve to the existing task without aborting the transaction
 * (INSERT … ON CONFLICT DO NOTHING), so callers can safely retry.
 */
export async function createTask(tx: Tx, input: NewTaskInput): Promise<CreatedTask> {
  const title = input.title.trim();
  if (!title) throw new DomainError("titleRequired");
  const scope = await scopeFor(tx, input);
  const s = input.schedule;

  const data: Prisma.TaskCreateManyInput = {
    ...scope,
    ownerId: input.ownerId,
    createdById: input.createdById,
    projectId: input.projectId ?? null,
    sectionId: input.sectionId ?? null,
    areaId: input.areaId ?? null,
    parentId: input.parentId ?? null,
    title,
    description: input.description ?? null,
    priority: input.priority ?? "NONE",
    isSomeday: (input.isSomeday ?? false) && !s.dueOn,
    isAllDay: s.isAllDay,
    timezone: s.timezone,
    startOn: s.startOn ? toDbDate(s.startOn) : null,
    startAt: s.startAt,
    dueOn: s.dueOn ? toDbDate(s.dueOn) : null,
    dueAt: s.dueAt,
    estimateMinutes: input.estimateMinutes ?? null,
    sortOrder: input.sortOrder ?? Date.now(),
    clientMutationId: input.clientMutationId ?? null,
    seriesId: input.occurrence?.seriesId ?? null,
    occurrenceOn: input.occurrence ? toDbDate(input.occurrence.occurrenceOn) : null,
  };

  const [row] = await tx.task.createManyAndReturn({ data: [data], skipDuplicates: true, select: { id: true } });
  if (!row) {
    const existing = await findExisting(tx, input);
    if (existing) return { id: existing, created: false };
    throw new Error("createTask: insert skipped without a matching idempotency key");
  }

  if (input.assignees?.length) {
    await tx.taskAssignee.createMany({ data: input.assignees.map((a) => ({ taskId: row.id, ...a })), skipDuplicates: true });
  }
  if (input.labelIds?.length) {
    await tx.taskLabel.createMany({ data: input.labelIds.map((labelId) => ({ taskId: row.id, labelId })), skipDuplicates: true });
  }
  await recordActivity(tx, {
    workspaceId: scope.workspaceId,
    actorId: input.createdById,
    entityType: "task",
    entityId: row.id,
    // "recurred" keeps the existing user-facing history wording for generated occurrences.
    action: input.source.kind === "RECURRENCE" ? "recurred" : "created",
    data: {
      source: input.source.kind,
      ...(input.source.ref ? { ref: input.source.ref } : {}),
      ...(input.source.kind === "RECURRENCE" && input.source.ref ? { from: input.source.ref.id } : {}),
    },
  });
  return { id: row.id, created: true };
}
