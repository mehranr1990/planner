import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { isCalendarDate, toDbDate, todayIn, type CalendarDate } from "@/lib/time";
import type { Viewer } from "@/server/context";
import type { PlannerFilters, PlannerView } from "../domain/planner-views";
import { OPEN_STATUSES, type TaskPriority, type TaskStatus } from "../types";

export type { PlannerFilters };

// Ownership fragments. Live here (not queries.ts) so both the per-view query builder and the
// advanced-filter layer share one definition of "mine"/"delegated" — no duplicate Prisma fragments.

/** "My work": assigned to me, or owned by me and not delegated to anyone else. */
function mineWhere(viewer: Viewer): Prisma.TaskWhereInput {
  const me = viewer.user.id;
  return { OR: [{ assignees: { some: { userId: me } } }, { ownerId: me, assignees: { none: {} } }] };
}

/** The complement of "mine" for delegated work: I own it, I handed it to someone else, I'm not one of them. */
export function delegatedWhere(viewer: Viewer): Prisma.TaskWhereInput {
  const me = viewer.user.id;
  return { ownerId: me, assignees: { some: {} }, NOT: { assignees: { some: { userId: me } } } };
}

/** The view's own default ownership scoping, ignoring any advanced filter — used for the
 * (always-unfiltered) nav badge counts in `getPlannerCounts`. */
export function ownershipWhere(viewer: Viewer, view: PlannerView): Prisma.TaskWhereInput {
  return view === "delegated" ? delegatedWhere(viewer) : mineWhere(viewer);
}

/**
 * The ownership fragment for a *filtered* planner query: `mineWhere`/`delegatedWhere` are mutually
 * exclusive by construction (delegated requires having assignees I'm not one of; mine requires
 * the opposite), so a `?delegated=1`/`?watched=1` filter can't just be ANDed on top of a
 * non-delegated view's default "mine" scoping — that would always produce zero rows. Instead,
 * those two filters each *replace* the view's default ownership scoping (they're alternative ways
 * of picking a working set, not narrowing refinements on top of "mine"), so "today + delegated" or
 * "all + watched" compose the way the filter UI promises. `watched` wins if both are set — an
 * unusual combination, but a defined one rather than a silent contradiction.
 */
export function resolveOwnership(viewer: Viewer, view: PlannerView, filters: PlannerFilters): Prisma.TaskWhereInput {
  if (filters.watched) return { watchers: { some: { userId: viewer.user.id } } };
  if (filters.delegated) return delegatedWhere(viewer);
  return ownershipWhere(viewer, view);
}

// Advanced-filter layer for the planner. One AND fragment per dimension, composed on top of the
// existing view/scope/ownership fragments in queries.ts — never a second query engine. Every
// fragment here only *narrows* an already-visibility-scoped query (`visibleTasksWhere` is always
// ANDed in by the caller), so an id the viewer can't otherwise see just matches nothing extra; no
// dimension here can expand what a filter is able to reveal.

const STATUSES: readonly TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"];
const PRIORITIES: readonly TaskPriority[] = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"];
const CUID_RE = /^[a-z0-9]{20,}$/i;

function first(raw: string | string[] | undefined): string | undefined {
  return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
}

function splitIds(raw: string | string[] | undefined): string[] | undefined {
  const value = first(raw);
  if (!value) return undefined;
  const ids = value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => CUID_RE.test(s));
  return ids.length > 0 ? ids : undefined;
}

function splitEnum<T extends string>(raw: string | string[] | undefined, allowed: readonly T[]): T[] | undefined {
  const value = first(raw);
  if (!value) return undefined;
  const set = new Set(allowed as readonly string[]);
  const values = value
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => set.has(s)) as T[];
  return values.length > 0 ? values : undefined;
}

function parseBool(raw: string | string[] | undefined): boolean | undefined {
  const value = first(raw);
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return undefined;
}

function parseDate(raw: string | string[] | undefined): CalendarDate | undefined {
  const value = first(raw);
  return value && isCalendarDate(value) ? value : undefined;
}

export type PlannerSearchParams = Record<string, string | string[] | undefined>;

/** Parses the planner's `?assignee=&creator=&...` filter params. Never trusts an id as proof of
 * access — every fragment this produces is ANDed with `visibleTasksWhere`, so a bogus or
 * inaccessible id just narrows the result to nothing extra, never exposes anything new. */
export function parsePlannerFilters(sp: PlannerSearchParams): PlannerFilters {
  return {
    assigneeIds: splitIds(sp.assignee),
    creatorIds: splitIds(sp.creator),
    status: splitEnum(sp.status, STATUSES),
    priority: splitEnum(sp.priority, PRIORITIES),
    labelIds: splitIds(sp.label),
    projectIds: splitIds(sp.project),
    dueBefore: parseDate(sp.dueBefore),
    dueAfter: parseDate(sp.dueAfter),
    overdue: parseBool(sp.overdue),
    completed: parseBool(sp.completed),
    delegated: parseBool(sp.delegated),
    watched: parseBool(sp.watched),
  };
}

export function hasActiveFilters(filters: PlannerFilters): boolean {
  return Object.values(filters).some((v) => v !== undefined);
}

export function plannerFiltersWhere(viewer: Viewer, filters: PlannerFilters): Prisma.TaskWhereInput[] {
  const frags: Prisma.TaskWhereInput[] = [];
  if (filters.assigneeIds) frags.push({ assignees: { some: { userId: { in: filters.assigneeIds } } } });
  if (filters.creatorIds) frags.push({ createdById: { in: filters.creatorIds } });
  if (filters.status) frags.push({ status: { in: filters.status } });
  if (filters.priority) frags.push({ priority: { in: filters.priority } });
  if (filters.labelIds) frags.push({ labels: { some: { labelId: { in: filters.labelIds } } } });
  if (filters.projectIds) frags.push({ projectId: { in: filters.projectIds } });
  // Already validated as a real calendar date by parsePlannerFilters (via isCalendarDate) before
  // reaching here — the branded CalendarDate type itself can't cross into the client-safe domain type.
  if (filters.dueBefore) frags.push({ dueOn: { lte: toDbDate(filters.dueBefore as CalendarDate) } });
  if (filters.dueAfter) frags.push({ dueOn: { gte: toDbDate(filters.dueAfter as CalendarDate) } });
  if (filters.overdue) {
    const t = toDbDate(todayIn(viewer.user.timezone));
    frags.push({ status: { in: [...OPEN_STATUSES] }, OR: [{ dueOn: { lt: t } }, { dueAt: { lt: new Date() } }] });
  }
  if (filters.completed === true) frags.push({ status: "DONE" });
  if (filters.completed === false) frags.push({ status: { notIn: ["DONE", "CANCELLED"] } });
  // delegated/watched are NOT narrowing AND fragments here — see `resolveOwnership`, which they
  // instead replace the view's default ownership scoping with (ANDing them on top of "mine" would
  // always produce zero rows, since "mine" and "delegated" are mutually exclusive by construction).
  return frags;
}
