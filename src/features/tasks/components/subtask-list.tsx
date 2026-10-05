"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { reorderTaskAction } from "../server/actions";
import type { TaskStatus } from "../types";

export interface SubtaskItem {
  id: string;
  title: string;
  status: TaskStatus;
  canEdit: boolean;
}

/**
 * Carries Batch 4's subtask-reorder service (`reorderTask`'s `orderingScope` already scopes to
 * `{ parentId }` for a subtask, integration-tested since Batch 4) into the TaskSheet UI — the one
 * piece of that batch's DnD work left unwired. Same dnd-kit sensors/optimistic-then-rollback shape
 * as `TaskListWithSelection`, just against a plain subtask row instead of the full `TaskRow`.
 */
export function SubtaskList({ subtasks, onOpen }: { subtasks: SubtaskItem[]; onOpen: (id: string) => void }) {
  const t = useTranslations("tasks");
  const router = useRouter();
  const [localSubtasks, setLocalSubtasks] = useState(subtasks);
  const [syncedSubtasks, setSyncedSubtasks] = useState(subtasks);
  const [, startReorder] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  // Reset local order DURING render (not a useEffect) whenever the server sends a new subtask
  // array — mirrors TaskListWithSelection's identity-check pattern.
  if (subtasks !== syncedSubtasks) {
    setSyncedSubtasks(subtasks);
    setLocalSubtasks(subtasks);
  }

  if (localSubtasks.length === 0) return <p className="px-1 text-[13px] text-foreground-subtle">{t("sheet.subtasksNone")}</p>;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = localSubtasks.map((s) => s.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    const beforeId = ids[to - (to > from ? 0 : 1)] ?? null;
    const afterId = ids[to + (to > from ? 1 : 0)] ?? null;

    setLocalSubtasks((prev) => {
      const moved = prev.find((s) => s.id === String(active.id));
      if (!moved) return prev;
      const rest = prev.filter((s) => s.id !== moved.id);
      const at = afterId ? rest.findIndex((s) => s.id === afterId) : rest.length;
      rest.splice(at === -1 ? rest.length : at, 0, moved);
      return rest;
    });
    startReorder(async () => {
      const res = await reorderTaskAction({ taskId: String(active.id), beforeId, afterId });
      if (!res.ok) router.refresh(); // rollback: re-fetch the authoritative order from the server
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids(localSubtasks)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-1">
          {localSubtasks.map((s) => (
            <SubtaskRow key={s.id} subtask={s} onOpen={() => onOpen(s.id)} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function ids(subtasks: SubtaskItem[]) {
  return subtasks.map((s) => s.id);
}

function SubtaskRow({ subtask, onOpen }: { subtask: SubtaskItem; onOpen: () => void }) {
  const t = useTranslations("tasks");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: subtask.id, disabled: !subtask.canEdit });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative flex items-center gap-0.5 rounded-[14px]", isDragging && "z-20 bg-surface-elevated opacity-90 shadow-overlay")}
    >
      {subtask.canEdit && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t("reorder.handle", { title: subtask.title })}
          className="relative z-10 ms-1 shrink-0 cursor-grab touch-none text-foreground-subtle opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      )}
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[14px] px-3 py-2 text-start text-sm hover:bg-surface-elevated"
      >
        <span
          aria-hidden
          className={cn(
            "inline-flex size-4 shrink-0 items-center justify-center rounded-full ring-[1.5px]",
            subtask.status === "DONE" ? "bg-surface-active ring-surface-active" : "ring-border-strong",
          )}
        >
          {subtask.status === "DONE" && <Check className="size-2.5 text-foreground-on-active" strokeWidth={3} />}
        </span>
        <span dir="auto" className={cn("min-w-0 flex-1 truncate", subtask.status === "DONE" && "text-foreground-subtle line-through")}>
          {subtask.title}
        </span>
      </button>
    </li>
  );
}
