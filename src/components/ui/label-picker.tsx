"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { Chip, toneOf, type Tone } from "./data-viz";
import { Input } from "./field";

export interface LabelOption {
  id: string;
  name: string;
  color: string;
}

const CREATE_TONES: Tone[] = ["blue", "green", "yellow", "peach", "red", "slate"];

/**
 * Search-and-toggle label picker (same shape as `PeoplePicker`), plus an inline "create" row
 * when the typed query matches nothing — labels are created on the fly, not from a separate page.
 */
export function LabelPicker({
  labels,
  selected,
  onChange,
  onCreate,
  label,
  placeholder,
}: {
  labels: readonly LabelOption[];
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  onCreate: (name: string, color: string) => Promise<LabelOption | null>;
  label: string;
  placeholder?: string;
}) {
  const t = useTranslations("common.labels");
  const tc = useTranslations("common.colors");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return labels;
    return labels.filter((l) => l.name.toLowerCase().includes(q));
  }, [labels, query]);
  const selectedLabels = labels.filter((l) => selected.includes(l.id));
  const exactMatch = labels.some((l) => l.name.toLowerCase() === query.trim().toLowerCase());

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  async function create(color: string) {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const created = await onCreate(name, color);
      if (created) {
        onChange([...selected, created.id]);
        setQuery("");
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {selectedLabels.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={label}>
          {selectedLabels.map((l) => (
            <li key={l.id}>
              <Chip tone={toneOf(l.color)}>
                <span dir="auto">{l.name}</span>
                <button type="button" onClick={() => toggle(l.id)} aria-label={t("remove", { name: l.name })} className="-me-0.5 ms-0.5 rounded-full hover:opacity-70">
                  <X className="size-3" aria-hidden />
                </button>
              </Chip>
            </li>
          ))}
        </ul>
      )}
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} dir="auto" aria-label={label} />
      <ul role="listbox" aria-label={label} aria-multiselectable className="flex max-h-60 flex-col gap-0.5 overflow-y-auto">
        {filtered.map((l) => {
          const isSelected = selected.includes(l.id);
          return (
            <li key={l.id}>
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => toggle(l.id)}
                className={cn("flex w-full items-center gap-3 rounded-[14px] px-3 py-2 text-start text-[14px] hover:bg-surface-elevated", isSelected && "bg-surface-elevated")}
              >
                <Chip tone={toneOf(l.color)}>
                  <span dir="auto">{l.name}</span>
                </Chip>
                {isSelected && <span aria-hidden className="ms-auto text-foreground-muted">✓</span>}
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && query.trim() === "" && <li className="px-3 py-2 text-[13px] text-foreground-muted">{t("noMatches")}</li>}
        {query.trim() !== "" && !exactMatch && (
          <li className="flex flex-col gap-2 rounded-[14px] px-3 py-2">
            <span className="text-[13px] text-foreground-muted">{t("createPrompt", { name: query.trim() })}</span>
            <div className="flex items-center gap-1.5">
              {CREATE_TONES.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  disabled={creating}
                  onClick={() => create(tone)}
                  aria-label={tc(tone)}
                  className={cn("size-6 rounded-full ring-1 ring-border-subtle disabled:opacity-50", { blue: "bg-accent-blue-soft", green: "bg-accent-green-soft", yellow: "bg-accent-yellow-soft", peach: "bg-accent-peach-soft", red: "bg-accent-red-soft", slate: "bg-accent-slate-soft" }[tone])}
                />
              ))}
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}
