"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { IconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import type { CalendarDate } from "@/lib/time";
import type { BoardColumn } from "@/features/tasks/server/queries";
import { moveTaskToSectionAction } from "@/features/tasks/server/actions";
import type { TaskListItem } from "@/features/tasks/types";
import { createSectionAction, renameSectionAction, reorderSectionAction } from "../../server/actions";
import { BoardCard } from "./board-card";
import { ColumnMenu } from "./column-menu";

/** Sentinel DOM id for the unsectioned ("no column") group — `null` isn't a valid dnd-kit item id. */
const UNSECTIONED = "__unsectioned__";

function domId(id: string | null) {
  return id ?? UNSECTIONED;
}

/**
 * Board view (Batch 5): columns = `ProjectSection` rows (`null`/unsectioned always first, never
 * draggable). One `DndContext` hosts both column-level reordering (`type: "column"`) and
 * card-level drag within/between columns (`type: "card"`) — the standard dnd-kit multi-container
 * pattern: `onDragOver` moves a card between columns' local arrays live (so the destination
 * column's own `SortableContext` reflows during the drag), `onDragEnd` persists the final
 * neighbor-based position server-side via `moveTaskToSectionAction`/`reorderSectionAction`, reusing
 * the exact ranking strategy Batch 4 established for tasks (never a second one).
 */
export function BoardView({ projectId, columns, today, timezone, canEditProject }: { projectId: string; columns: BoardColumn[]; today: CalendarDate; timezone: string; canEditProject: boolean }) {
  const router = useRouter();
  const [localColumns, setLocalColumns] = useState(columns);
  const [syncedColumns, setSyncedColumns] = useState(columns);
  const [activeCard, setActiveCard] = useState<TaskListItem | null>(null);
  const [, startAction] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  // Reset local state DURING render (not a useEffect) whenever the server sends new columns —
  // mirrors TaskListWithSelection's identity-check pattern.
  if (columns !== syncedColumns) {
    setSyncedColumns(columns);
    setLocalColumns(columns);
  }

  function columnIndexOfCard(cardId: string) {
    return localColumns.findIndex((c) => c.tasks.some((task) => task.id === cardId));
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    if (data?.type === "card") setActiveCard(data.task as TaskListItem);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.data.current?.type !== "card") return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const fromIndex = columnIndexOfCard(activeId);
    const toIndex = over.data.current?.type === "card" ? columnIndexOfCard(overId) : localColumns.findIndex((c) => domId(c.id) === overId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    setLocalColumns((prev) => {
      const next = prev.map((c) => ({ ...c, tasks: [...c.tasks] }));
      const fromTasks = next[fromIndex].tasks;
      const movedIndex = fromTasks.findIndex((task) => task.id === activeId);
      if (movedIndex === -1) return prev;
      const [moved] = fromTasks.splice(movedIndex, 1);
      const toTasks = next[toIndex].tasks;
      const overCardIndex = toTasks.findIndex((task) => task.id === overId);
      toTasks.splice(overCardIndex === -1 ? toTasks.length : overCardIndex, 0, moved);
      return next;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;
    const type = active.data.current?.type;

    if (type === "column") {
      const sectionIds = localColumns.filter((c) => c.id !== null).map((c) => domId(c.id));
      const from = sectionIds.indexOf(String(active.id));
      const to = String(over.id) === UNSECTIONED ? 0 : sectionIds.indexOf(String(over.id));
      if (from === -1 || to === -1 || from === to) return;
      const reordered = [...sectionIds];
      reordered.splice(from, 1);
      reordered.splice(to, 0, sectionIds[from]);

      setLocalColumns((prev) => {
        const unsectioned = prev.find((c) => c.id === null);
        const byId = new Map(prev.filter((c) => c.id !== null).map((c) => [domId(c.id), c]));
        return [...(unsectioned ? [unsectioned] : []), ...reordered.map((id) => byId.get(id)!)];
      });
      const newIndex = reordered.indexOf(sectionIds[from]);
      const beforeId = reordered[newIndex - 1] ?? null;
      const afterId = reordered[newIndex + 1] ?? null;
      startAction(async () => {
        const res = await reorderSectionAction({ sectionId: String(active.id), beforeId, afterId });
        if (!res.ok) router.refresh();
      });
      return;
    }

    if (type === "card") {
      const taskId = String(active.id);
      const colIndex = columnIndexOfCard(taskId);
      if (colIndex === -1) return;
      const column = localColumns[colIndex];
      const ids = column.tasks.map((task) => task.id);
      const pos = ids.indexOf(taskId);
      const beforeId = pos > 0 ? ids[pos - 1] : null;
      const afterId = pos < ids.length - 1 ? ids[pos + 1] : null;
      startAction(async () => {
        const res = await moveTaskToSectionAction({ taskId, sectionId: column.id, beforeId, afterId });
        if (!res.ok) router.refresh();
      });
    }
  }

  const sectionIds = localColumns.filter((c) => c.id !== null).map((c) => domId(c.id));

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="scrollbar-none -mx-4 flex items-start gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        <SortableContext items={[UNSECTIONED, ...sectionIds]} strategy={horizontalListSortingStrategy}>
          {localColumns.map((column) => (
            <Column key={domId(column.id)} column={column} today={today} timezone={timezone} draggable={canEditProject && column.id !== null} />
          ))}
        </SortableContext>
        {canEditProject && <NewColumn projectId={projectId} />}
      </div>
      <DragOverlay>{activeCard && <BoardCard task={activeCard} today={today} timezone={timezone} overlay />}</DragOverlay>
    </DndContext>
  );
}

function Column({ column, today, timezone, draggable }: { column: BoardColumn; today: CalendarDate; timezone: string; draggable: boolean }) {
  const t = useTranslations("board");
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: domId(column.id), data: { type: "column" }, disabled: !draggable });
  const taskIds = column.tasks.map((task) => task.id);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(column.name);
  const [renamePending, startRename] = useTransition();

  function submitRename() {
    const trimmed = name.trim();
    if (!trimmed || !column.id) return;
    startRename(async () => {
      const res = await renameSectionAction({ sectionId: column.id!, name: trimmed });
      if (res.ok) {
        setRenaming(false);
        router.refresh();
      }
    });
  }

  return (
    <section
      ref={setNodeRef}
      aria-label={column.id === null ? t("unsectioned") : column.name}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex w-72 shrink-0 flex-col rounded-[20px] bg-surface-elevated p-3", isDragging && "opacity-60")}
    >
      <header className="mb-2 flex items-center gap-2 px-1">
        {draggable && (
          <button type="button" {...attributes} {...listeners} aria-label={t("reorderColumn", { name: column.name })} className="shrink-0 cursor-grab touch-none text-foreground-subtle active:cursor-grabbing">
            <GripVertical className="size-4" aria-hidden />
          </button>
        )}
        {renaming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitRename();
            }}
            className="flex min-w-0 flex-1 items-center gap-1"
          >
            <Input autoFocus dir="auto" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="h-7 text-[13px]" />
            <IconButton type="submit" size="sm" label={t("save")} disabled={renamePending || !name.trim()}>
              <Check className="size-3.5" aria-hidden />
            </IconButton>
            <IconButton
              type="button"
              size="sm"
              label={t("cancel")}
              disabled={renamePending}
              onClick={() => {
                setName(column.name);
                setRenaming(false);
              }}
            >
              <X className="size-3.5" aria-hidden />
            </IconButton>
          </form>
        ) : (
          <>
            <h3 className="min-w-0 flex-1 truncate text-[13px] font-medium" dir="auto">
              {column.id === null ? t("unsectioned") : column.name}
            </h3>
            <span className="tabular shrink-0 text-[12px] text-foreground-subtle">{column.tasks.length}</span>
            {draggable && column.id !== null && (
              <ColumnMenu
                sectionId={column.id}
                name={column.name}
                onRename={() => {
                  setName(column.name);
                  setRenaming(true);
                }}
              />
            )}
          </>
        )}
      </header>
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-12 flex-col gap-2">
          {column.tasks.map((task) => (
            <BoardCard key={task.id} task={task} today={today} timezone={timezone} />
          ))}
          {column.tasks.length === 0 && <p className="rounded-[14px] px-2 py-4 text-center text-[12px] text-foreground-subtle">{t("empty")}</p>}
        </div>
      </SortableContext>
    </section>
  );
}

function NewColumn({ projectId }: { projectId: string }) {
  const t = useTranslations("board");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <IconButton label={t("addColumn")} onClick={() => setOpen(true)} className="mt-9 shrink-0 bg-surface-elevated">
        <Plus className="size-4" aria-hidden />
      </IconButton>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        setError(null);
        start(async () => {
          const res = await createSectionAction({ projectId, name: trimmed });
          if (res.ok) {
            setName("");
            setOpen(false);
            router.refresh();
          } else setError(res.error ?? null);
        });
      }}
      className="flex w-72 shrink-0 flex-col gap-2 rounded-[20px] bg-surface-elevated p-3"
    >
      <label htmlFor="new-column-name" className="sr-only">
        {t("addColumn")}
      </label>
      <Input id="new-column-name" dir="auto" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t("columnNamePlaceholder")} maxLength={120} />
      {error && (
        <p role="alert" className="text-[12px] text-accent-red">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={!name.trim() || pending} className="h-8 flex-1 rounded-full bg-surface-active px-3 text-[12.5px] text-foreground-on-active disabled:opacity-40">
          {t("addColumn")}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-full px-3 text-[12.5px] text-foreground-muted ring-1 ring-border-subtle">
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
