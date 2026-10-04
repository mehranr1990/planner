"use client";

import { Ban, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { addDependencyAction, removeDependencyAction, searchDependencyCandidatesAction } from "../server/actions";
import type { TaskDependencyRef } from "../types";

const OPEN_STATUSES = new Set(["TODO", "IN_PROGRESS", "BLOCKED"]);
const SEARCH_DEBOUNCE_MS = 250;

export function DependencyPicker({
  taskId,
  blockedBy,
  blocking,
  readOnly,
  onError,
}: {
  taskId: string;
  blockedBy: readonly TaskDependencyRef[];
  blocking: readonly TaskDependencyRef[];
  readOnly: boolean;
  onError: (message: string | null) => void;
}) {
  const t = useTranslations("tasks.sheet.dependencies");
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TaskDependencyRef[]>([]);
  const [searching, setSearching] = useState(false);
  const [localBlockedBy, setLocalBlockedBy] = useState(blockedBy);
  const [localBlocking, setLocalBlocking] = useState(blocking);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function search(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const res = await searchDependencyCandidatesAction({ taskId, query: trimmed });
      setResults(res);
      setSearching(false);
    }, SEARCH_DEBOUNCE_MS);
  }

  function addBlockedBy(candidate: TaskDependencyRef) {
    setLocalBlockedBy((prev) => [...prev, candidate]);
    setQuery("");
    setResults([]);
    start(async () => {
      const res = await addDependencyAction({ blockingTaskId: candidate.id, blockedTaskId: taskId });
      if (!res.ok) {
        onError(res.error ?? null);
        setLocalBlockedBy((prev) => prev.filter((d) => d.id !== candidate.id));
      }
    });
  }

  function addBlocking(candidate: TaskDependencyRef) {
    setLocalBlocking((prev) => [...prev, candidate]);
    setQuery("");
    setResults([]);
    start(async () => {
      const res = await addDependencyAction({ blockingTaskId: taskId, blockedTaskId: candidate.id });
      if (!res.ok) {
        onError(res.error ?? null);
        setLocalBlocking((prev) => prev.filter((d) => d.id !== candidate.id));
      }
    });
  }

  function removeBlockedBy(candidate: TaskDependencyRef) {
    setLocalBlockedBy((prev) => prev.filter((d) => d.id !== candidate.id));
    start(async () => {
      const res = await removeDependencyAction({ blockingTaskId: candidate.id, blockedTaskId: taskId });
      if (!res.ok) {
        onError(res.error ?? null);
        setLocalBlockedBy((prev) => [...prev, candidate]);
      }
    });
  }

  function removeBlocking(candidate: TaskDependencyRef) {
    setLocalBlocking((prev) => prev.filter((d) => d.id !== candidate.id));
    start(async () => {
      const res = await removeDependencyAction({ blockingTaskId: taskId, blockedTaskId: candidate.id });
      if (!res.ok) {
        onError(res.error ?? null);
        setLocalBlocking((prev) => [...prev, candidate]);
      }
    });
  }

  const isBlocked = localBlockedBy.some((d) => OPEN_STATUSES.has(d.status));
  const linkedIds = new Set([...localBlockedBy.map((d) => d.id), ...localBlocking.map((d) => d.id)]);
  const pickable = results.filter((r) => !linkedIds.has(r.id));

  return (
    <div className="flex flex-col gap-3">
      {isBlocked && (
        <p role="status" className="rounded-[14px] bg-accent-red-soft/40 px-3 py-2 text-[12.5px]">
          {t("blockedNotice")}
        </p>
      )}

      <div>
        <h4 className="mb-1.5 px-1 text-[11.5px] text-foreground-subtle">{t("blockedByLabel")}</h4>
        {localBlockedBy.length === 0 ? (
          <p className="px-1 text-[13px] text-foreground-subtle">{t("none")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {localBlockedBy.map((d) => (
              <li key={d.id} className="flex items-center gap-2 rounded-[14px] px-3 py-1.5 text-[13px] hover:bg-surface-elevated">
                <Ban className={cn("size-3.5 shrink-0", OPEN_STATUSES.has(d.status) ? "text-accent-red" : "text-foreground-subtle")} aria-hidden />
                <span dir="auto" className="min-w-0 flex-1 truncate">
                  {d.title}
                </span>
                {!readOnly && (
                  <IconButton label={t("remove", { title: d.title })} size="sm" disabled={pending} onClick={() => removeBlockedBy(d)}>
                    <X className="size-3.5" aria-hidden />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="mb-1.5 px-1 text-[11.5px] text-foreground-subtle">{t("blockingLabel")}</h4>
        {localBlocking.length === 0 ? (
          <p className="px-1 text-[13px] text-foreground-subtle">{t("none")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {localBlocking.map((d) => (
              <li key={d.id} className="flex items-center gap-2 rounded-[14px] px-3 py-1.5 text-[13px] hover:bg-surface-elevated">
                <span dir="auto" className="min-w-0 flex-1 truncate">
                  {d.title}
                </span>
                {!readOnly && (
                  <IconButton label={t("remove", { title: d.title })} size="sm" disabled={pending} onClick={() => removeBlocking(d)}>
                    <X className="size-3.5" aria-hidden />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!readOnly && (
        <div className="flex flex-col gap-2">
          <Input value={query} onChange={(e) => search(e.target.value)} placeholder={t("searchPlaceholder")} dir="auto" aria-label={t("searchPlaceholder")} />
          {query.trim() !== "" && (
            <ul className="flex max-h-40 flex-col gap-0.5 overflow-y-auto rounded-[14px] bg-surface-elevated p-1">
              {searching && <li className="px-3 py-2 text-[12.5px] text-foreground-muted">{t("searching")}</li>}
              {!searching && pickable.length === 0 && <li className="px-3 py-2 text-[12.5px] text-foreground-muted">{t("noMatches")}</li>}
              {!searching &&
                pickable.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 px-2 py-1.5">
                    <span dir="auto" className="min-w-0 flex-1 truncate text-[13px]">
                      {r.title}
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => addBlockedBy(r)}
                      className="shrink-0 rounded-full px-2 py-1 text-[11.5px] whitespace-nowrap ring-1 ring-border-subtle hover:ring-border-strong"
                    >
                      {t("markBlocking")}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => addBlocking(r)}
                      className="shrink-0 rounded-full px-2 py-1 text-[11.5px] whitespace-nowrap ring-1 ring-border-subtle hover:ring-border-strong"
                    >
                      {t("markBlocked")}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
