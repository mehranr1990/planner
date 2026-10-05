// Client-safe milestone shapes (Batch 5). Mirrors tasks/types.ts's convention: server code maps
// Prisma rows into these; client components import only from here.

import type { CalendarDate } from "@/lib/time";

export type MilestoneStatus = "OPEN" | "COMPLETED";

export interface MilestoneSummary {
  id: string;
  title: string;
  description: string | null;
  dueOn: CalendarDate | null;
  status: MilestoneStatus;
  /** Computed server-side at request time (OPEN + dueOn in the past), never stored. */
  isOverdue: boolean;
  /** Always derived from associated tasks (done / total) — never a stored, driftable percentage. */
  progress: { done: number; total: number };
  canEdit: boolean;
}

export interface MilestoneOption {
  id: string;
  title: string;
}
