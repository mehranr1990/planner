// Planner view catalogue. Query translation lives in src/features/tasks/server/queries.ts.

export const PLANNER_VIEWS = ["inbox", "today", "upcoming", "overdue", "scheduled", "someday", "completed", "all", "delegated"] as const;

export type PlannerView = (typeof PLANNER_VIEWS)[number];

export function isPlannerView(value: string): value is PlannerView {
  return (PLANNER_VIEWS as readonly string[]).includes(value);
}

// Labels, descriptions and empty states live in messages/<locale>/planner.json (planner.views.<view>).

/** Context filter for the planner: everything, personal only, or one workspace. */
export type PlannerScopeFilter = { kind: "all" } | { kind: "personal" } | { kind: "workspace"; workspaceId: string };
