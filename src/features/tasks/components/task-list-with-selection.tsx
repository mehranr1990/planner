"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type { CalendarDate } from "@/lib/time";
import type { PlannerView } from "../domain/planner-views";
import { reorderTaskAction } from "../server/actions";
import type { TaskListItem } from "../types";
import { BulkToolbar } from "./bulk-toolbar";
import { TaskList } from "./task-list";

/**
 * Owns bulk-selection state and the optimistic local task order for drag-and-drop — both are
 * ephemeral, view-scoped UI state, so they live here (not in the server-rendered `TaskList`) and
 * reset automatically whenever the server sends a new `tasks` array (view/filter/scope change, or
 * a refresh after a bulk action or a failed reorder).
 */
type Option = { id: string; name: string; color?: string };

export function TaskListWithSelection({
  view,
  tasks,
  today,
  timezone,
  showContext,
  empty,
  orderable,
  labelOptions,
  memberOptions,
  projectOptions,
}: {
  view: PlannerView | "project";
  tasks: TaskListItem[];
  today: CalendarDate;
  timezone: string;
  showContext: boolean;
  empty: { title: string; hint: string };
  orderable: boolean;
  labelOptions: Option[];
  memberOptions: Option[];
  projectOptions: Option[];
}) {
  const t = useTranslations("tasks.bulk");
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [localTasks, setLocalTasks] = useState(tasks);
  // Tracks the last `tasks` prop identity seen so a new one (view/filter/scope change, or a
  // refresh after a bulk action or a failed reorder) resets local state DURING render — adjusting
  // state while rendering, not in a (`useEffect`) cascading-render-triggering side effect.
  const [syncedTasks, setSyncedTasks] = useState(tasks);
  const [, startReorder] = useTransition();

  if (tasks !== syncedTasks) {
    setSyncedTasks(tasks);
    setLocalTasks(tasks);
    // `resultMessage` deliberately does NOT reset here: this branch also fires for the refresh a
    // bulk action's own `onDone` triggers, and clearing it then would hide the message almost as
    // soon as it appeared. It clears instead on the next selection (`toggle`, below).
    // Never let a selection survive a task leaving scope (filtered out, view changed, deleted…).
    const ids = new Set(tasks.map((task) => task.id));
    setSelected((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (ids.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }

  function toggle(id: string) {
    setResultMessage(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === localTasks.length ? new Set() : new Set(localTasks.map((task) => task.id))));
  }

  function handleReorder(taskId: string, beforeId: string | null, afterId: string | null) {
    setLocalTasks((prev) => {
      const moved = prev.find((task) => task.id === taskId);
      if (!moved) return prev;
      const rest = prev.filter((task) => task.id !== taskId);
      const at = afterId ? rest.findIndex((task) => task.id === afterId) : rest.length;
      rest.splice(at === -1 ? rest.length : at, 0, moved);
      return rest;
    });
    startReorder(async () => {
      const res = await reorderTaskAction({ taskId, beforeId, afterId });
      if (!res.ok) router.refresh(); // rollback: re-fetch the authoritative order from the server
    });
  }

  return (
    <div>
      {(localTasks.length > 0 || resultMessage) && (
        <div className="mb-2 flex min-h-8 flex-wrap items-center gap-3">
          {localTasks.length > 0 && (
            <label className="flex items-center gap-2 text-[12px] text-foreground-muted">
              <input type="checkbox" checked={selected.size > 0 && selected.size === localTasks.length} onChange={toggleAll} className="size-3.5" />
              {selected.size > 0 ? t("selectedCount", { count: selected.size }) : t("selectAll")}
            </label>
          )}
          {selected.size > 0 && (
            <BulkToolbar
              selectedIds={[...selected]}
              labelOptions={labelOptions}
              memberOptions={memberOptions}
              projectOptions={projectOptions}
              // Reports the result BEFORE clearing the selection — clearing unmounts this toolbar
              // in the same render pass, and the server refresh that follows may shrink `tasks` to
              // empty (e.g. every selected task left the view), so the message's own visibility
              // can't depend on `localTasks.length` either — it must outlive both.
              onDone={(message) => {
                setResultMessage(message);
                setSelected(new Set());
                router.refresh();
              }}
            />
          )}
          {resultMessage && (
            <span role="status" className="text-[12px] text-foreground-muted">
              {resultMessage}
            </span>
          )}
        </div>
      )}
      <TaskList
        view={view}
        tasks={localTasks}
        today={today}
        timezone={timezone}
        showContext={showContext}
        empty={empty}
        selection={{ selectedIds: selected, onToggle: toggle }}
        reorder={orderable ? { onReorder: handleReorder } : undefined}
      />
    </div>
  );
}
