// Planner view catalogue. Query translation lives in src/features/tasks/server/queries.ts.

export const PLANNER_VIEWS = ["inbox", "today", "upcoming", "overdue", "scheduled", "someday", "completed", "all", "delegated"] as const;

export type PlannerView = (typeof PLANNER_VIEWS)[number];

export function isPlannerView(value: string): value is PlannerView {
  return (PLANNER_VIEWS as readonly string[]).includes(value);
}

// Labels, descriptions and empty states live in messages/<locale>/planner.json (planner.views.<view>).

/** Context filter for the planner: everything, personal only, or one workspace. */
export type PlannerScopeFilter = { kind: "all" } | { kind: "personal" } | { kind: "workspace"; workspaceId: string };

/** Advanced-filter state (Batch 4). Parsing/query-translation live in server/filters.ts; this
 * plain, server-only-free shape is what both that module and the client filter UI import, so a
 * client component can hold/display it without pulling in any server-only code. */
export interface PlannerFilters {
  assigneeIds?: string[];
  creatorIds?: string[];
  status?: ("TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED")[];
  priority?: ("NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT")[];
  labelIds?: string[];
  projectIds?: string[];
  dueBefore?: string;
  dueAfter?: string;
  overdue?: boolean;
  /** true = only completed (DONE); false = exclude completed/cancelled ("incomplete"). */
  completed?: boolean;
  delegated?: boolean;
  watched?: boolean;
}
