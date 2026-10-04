"use client";

import { ListFilter, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { Chip, toneOf } from "@/components/ui/data-viz";
import { cn } from "@/lib/cn";

// Compact filter popover + active-filter chips for the Planner, consistent with the existing
// hand-built <details> popover pattern (ContextSwitcher, NotificationBell) — no new UI library
// (Q-PO-10, PHASE_3.md §C). Every control writes straight to the URL on change (no draft/"Apply"
// state): parsing/validation of those params happens server-side in server/filters.ts, this
// component only reads/writes the query string for display and navigation.

const FILTER_KEYS = ["assignee", "creator", "status", "priority", "label", "project", "dueBefore", "dueAfter", "overdue", "completed", "delegated", "watched"] as const;

type Option = { id: string; name: string; color?: string };

export function FilterBar({
  memberOptions,
  labelOptions,
  projectOptions,
}: {
  memberOptions: Option[];
  labelOptions: Option[];
  projectOptions: Option[];
}) {
  const t = useTranslations("planner.filters");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const ref = useRef<HTMLDetailsElement>(null);

  const activeCount = FILTER_KEYS.reduce((n, k) => n + (sp.get(k) ? 1 : 0), 0);

  function navigate(next: URLSearchParams) {
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(sp);
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    navigate(next);
  }

  function toggleInList(key: string, id: string) {
    const current = (sp.get(key) ?? "").split(",").filter(Boolean);
    const next = current.includes(id) ? current.filter((v) => v !== id) : [...current, id];
    setParam(key, next.length > 0 ? next.join(",") : null);
  }

  function toggleBool(key: string) {
    setParam(key, sp.get(key) ? null : "1");
  }

  function clearAll() {
    const next = new URLSearchParams(sp);
    for (const k of FILTER_KEYS) next.delete(k);
    navigate(next);
  }

  function removeFilter(key: string, value?: string) {
    if (value === undefined) return setParam(key, null);
    toggleInList(key, value);
  }

  const inList = (key: string, id: string) => (sp.get(key) ?? "").split(",").includes(id);

  const PRIORITY_VALUES = ["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"] as const;
  const STATUS_VALUES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"] as const;

  const chips: { key: string; value?: string; label: string }[] = [];
  for (const id of (sp.get("assignee") ?? "").split(",").filter(Boolean)) {
    const m = memberOptions.find((o) => o.id === id);
    if (m) chips.push({ key: "assignee", value: id, label: t("chip.assignee", { name: m.name }) });
  }
  for (const id of (sp.get("creator") ?? "").split(",").filter(Boolean)) {
    const m = memberOptions.find((o) => o.id === id);
    if (m) chips.push({ key: "creator", value: id, label: t("chip.creator", { name: m.name }) });
  }
  for (const id of (sp.get("label") ?? "").split(",").filter(Boolean)) {
    const l = labelOptions.find((o) => o.id === id);
    if (l) chips.push({ key: "label", value: id, label: t("chip.label", { name: l.name }) });
  }
  for (const id of (sp.get("project") ?? "").split(",").filter(Boolean)) {
    const p = projectOptions.find((o) => o.id === id);
    if (p) chips.push({ key: "project", value: id, label: t("chip.project", { name: p.name }) });
  }
  for (const value of (sp.get("priority") ?? "").split(",").filter(Boolean)) {
    if (!(PRIORITY_VALUES as readonly string[]).includes(value)) continue;
    chips.push({ key: "priority", value, label: t("chip.priority", { value: t(`priority.${value as (typeof PRIORITY_VALUES)[number]}`) }) });
  }
  for (const value of (sp.get("status") ?? "").split(",").filter(Boolean)) {
    if (!(STATUS_VALUES as readonly string[]).includes(value)) continue;
    chips.push({ key: "status", value, label: t("chip.status", { value: t(`status.${value as (typeof STATUS_VALUES)[number]}`) }) });
  }
  if (sp.get("overdue")) chips.push({ key: "overdue", label: t("chip.overdue") });
  if (sp.get("completed") === "1") chips.push({ key: "completed", label: t("chip.completedOnly") });
  if (sp.get("completed") === "0") chips.push({ key: "completed", label: t("chip.incomplete") });
  if (sp.get("delegated")) chips.push({ key: "delegated", label: t("chip.delegated") });
  if (sp.get("watched")) chips.push({ key: "watched", label: t("chip.watched") });

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <details ref={ref} className="group relative">
        <summary
          className={cn(
            "flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium ring-1 select-none [&::-webkit-details-marker]:hidden",
            activeCount > 0 ? "bg-surface-active text-foreground-on-active ring-surface-active" : "bg-surface-elevated text-foreground-muted ring-border-subtle hover:text-foreground",
          )}
        >
          <ListFilter className="size-3.5" aria-hidden />
          {t("trigger")}
          {activeCount > 0 && <span className="tabular rounded-full bg-white/15 px-1.5 text-[11px]">{activeCount}</span>}
        </summary>
        <div className="animate-overlay absolute top-10 start-0 z-40 flex w-72 flex-col gap-3 rounded-[20px] bg-surface-elevated p-3 shadow-overlay ring-1 ring-border-subtle">
          <section>
            <p className="mb-1.5 text-[11.5px] font-medium text-foreground-muted">{t("section.priority")}</p>
            <div className="flex flex-wrap gap-1">
              {PRIORITY_VALUES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => toggleInList("priority", v)}
                  aria-pressed={inList("priority", v)}
                  className={cn(
                    "h-7 rounded-full px-2.5 text-[12px] ring-1",
                    inList("priority", v) ? "bg-surface-active text-foreground-on-active ring-surface-active" : "ring-border-subtle hover:ring-border-strong",
                  )}
                >
                  {t(`priority.${v}`)}
                </button>
              ))}
            </div>
          </section>
          <section>
            <p className="mb-1.5 text-[11.5px] font-medium text-foreground-muted">{t("section.status")}</p>
            <div className="flex flex-wrap gap-1">
              {STATUS_VALUES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => toggleInList("status", v)}
                  aria-pressed={inList("status", v)}
                  className={cn(
                    "h-7 rounded-full px-2.5 text-[12px] ring-1",
                    inList("status", v) ? "bg-surface-active text-foreground-on-active ring-surface-active" : "ring-border-subtle hover:ring-border-strong",
                  )}
                >
                  {t(`status.${v}`)}
                </button>
              ))}
            </div>
          </section>
          {labelOptions.length > 0 && (
            <section>
              <p className="mb-1.5 text-[11.5px] font-medium text-foreground-muted">{t("section.label")}</p>
              <div className="flex flex-wrap gap-1">
                {labelOptions.map((l) => (
                  <button key={l.id} type="button" onClick={() => toggleInList("label", l.id)} aria-pressed={inList("label", l.id)}>
                    <Chip tone={toneOf(l.color ?? "slate")} className={cn("ring-1", inList("label", l.id) ? "ring-foreground" : "ring-transparent")}>
                      <span dir="auto">{l.name}</span>
                    </Chip>
                  </button>
                ))}
              </div>
            </section>
          )}
          {memberOptions.length > 0 && (
            <section>
              <p className="mb-1.5 text-[11.5px] font-medium text-foreground-muted">{t("section.assignee")}</p>
              <div className="flex max-h-32 flex-col gap-0.5 overflow-y-auto">
                {memberOptions.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 rounded-[10px] px-1.5 py-1 text-[12.5px] hover:bg-surface-secondary">
                    <input type="checkbox" checked={inList("assignee", m.id)} onChange={() => toggleInList("assignee", m.id)} className="size-3.5" />
                    <span dir="auto" className="truncate">
                      {m.name}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}
          {memberOptions.length > 0 && (
            <section>
              <p className="mb-1.5 text-[11.5px] font-medium text-foreground-muted">{t("section.creator")}</p>
              <div className="flex max-h-32 flex-col gap-0.5 overflow-y-auto">
                {memberOptions.map((m) => (
                  <label key={`creator-${m.id}`} className="flex items-center gap-2 rounded-[10px] px-1.5 py-1 text-[12.5px] hover:bg-surface-secondary">
                    <input type="checkbox" checked={inList("creator", m.id)} onChange={() => toggleInList("creator", m.id)} className="size-3.5" />
                    <span dir="auto" className="truncate">
                      {m.name}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}
          {projectOptions.length > 0 && (
            <section>
              <p className="mb-1.5 text-[11.5px] font-medium text-foreground-muted">{t("section.project")}</p>
              <div className="flex max-h-32 flex-col gap-0.5 overflow-y-auto">
                {projectOptions.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 rounded-[10px] px-1.5 py-1 text-[12.5px] hover:bg-surface-secondary">
                    <input type="checkbox" checked={inList("project", p.id)} onChange={() => toggleInList("project", p.id)} className="size-3.5" />
                    <span dir="auto" className="truncate">
                      {p.name}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}
          <section>
            <p className="mb-1.5 text-[11.5px] font-medium text-foreground-muted">{t("section.due")}</p>
            <div className="flex items-center gap-2 text-[12px]">
              <input
                type="date"
                aria-label={t("dueAfter")}
                defaultValue={sp.get("dueAfter") ?? ""}
                onChange={(e) => setParam("dueAfter", e.target.value || null)}
                className="h-8 min-w-0 flex-1 rounded-[10px] bg-surface-secondary px-2 ring-1 ring-border-subtle"
              />
              <span className="text-foreground-subtle">–</span>
              <input
                type="date"
                aria-label={t("dueBefore")}
                defaultValue={sp.get("dueBefore") ?? ""}
                onChange={(e) => setParam("dueBefore", e.target.value || null)}
                className="h-8 min-w-0 flex-1 rounded-[10px] bg-surface-secondary px-2 ring-1 ring-border-subtle"
              />
            </div>
          </section>
          <section className="flex flex-wrap gap-1">
            {(["overdue", "delegated", "watched"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleBool(key)}
                aria-pressed={!!sp.get(key)}
                className={cn(
                  "h-7 rounded-full px-2.5 text-[12px] ring-1",
                  sp.get(key) ? "bg-surface-active text-foreground-on-active ring-surface-active" : "ring-border-subtle hover:ring-border-strong",
                )}
              >
                {t(`toggle.${key}`)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setParam("completed", sp.get("completed") === "0" ? null : "0")}
              aria-pressed={sp.get("completed") === "0"}
              className={cn(
                "h-7 rounded-full px-2.5 text-[12px] ring-1",
                sp.get("completed") === "0" ? "bg-surface-active text-foreground-on-active ring-surface-active" : "ring-border-subtle hover:ring-border-strong",
              )}
            >
              {t("toggle.incomplete")}
            </button>
          </section>
          {activeCount > 0 && (
            <button type="button" onClick={clearAll} className="self-start text-[12px] text-foreground-muted hover:text-foreground">
              {t("clearAll")}
            </button>
          )}
        </div>
      </details>
      {chips.map((c, i) => (
        <button
          key={`${c.key}:${c.value ?? i}`}
          type="button"
          onClick={() => removeFilter(c.key, c.value)}
          className="flex h-7 items-center gap-1 rounded-full bg-surface-elevated px-2.5 text-[12px] text-foreground-muted ring-1 ring-border-subtle hover:text-foreground"
        >
          <span dir="auto">{c.label}</span>
          <X className="size-3" aria-hidden />
        </button>
      ))}
    </div>
  );
}
