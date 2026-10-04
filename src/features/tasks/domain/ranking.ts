// Fractional-index ordering for manual drag-and-drop (Task.sortOrder, ChecklistItem.sortOrder,
// etc. already share this Float column pattern — see docs/DATA_MODEL.md). Pure math only; never
// touches the database and is never evaluated on the client — the server always has the final
// say on the stored value (see reorderTask / reorderSubtask in server/service.ts).

/** Below this gap, two ranks are too close to insert cleanly between — a rebalance is needed first. */
const MIN_GAP = 1e-6;

/** Spacing used when (re)seeding a run of siblings that collapsed onto the same/too-close values. */
export const REBALANCE_STEP = 1024;

/** True when `before`/`after` are too close (or equal) to compute a usable midpoint between them. */
export function needsRebalance(before: number | null, after: number | null): boolean {
  if (before === null || after === null) return false; // an open end never needs rebalancing
  return after - before < MIN_GAP;
}

/**
 * The rank to give a row dropped between `before` and `after` (either may be absent at a list
 * edge). Does not itself decide whether a rebalance is needed first — callers check
 * `needsRebalance` and, if true, reseed the affected run (see REBALANCE_STEP) before calling this.
 */
export function rankBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 0;
  if (before === null) return after! - REBALANCE_STEP;
  if (after === null) return before + REBALANCE_STEP;
  return before + (after - before) / 2;
}

/** Fresh, evenly spaced ranks for a run of `count` siblings (used to reseed a collapsed run). */
export function reseedRun(count: number, startAfter: number | null = null): number[] {
  const base = startAfter ?? 0;
  return Array.from({ length: count }, (_, i) => base + (i + 1) * REBALANCE_STEP);
}
