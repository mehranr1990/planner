"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { Avatar } from "./avatar";
import { Input } from "./field";
import { PeopleCluster } from "./people-cluster";
import type { PersonRef } from "./people";

/**
 * Permission-filtered member search: the caller passes only the people selectable in this
 * context (already access-checked server-side). Renders the current selection via PeopleCluster.
 */
export function PeoplePicker({
  people,
  selected,
  onChange,
  label,
  placeholder,
  multiple = true,
}: {
  people: readonly PersonRef[];
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  label: string;
  placeholder?: string;
  multiple?: boolean;
}) {
  const t = useTranslations("common.people");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => p.name.toLowerCase().includes(q));
  }, [people, query]);
  const selectedPeople = people.filter((p) => selected.includes(p.id));

  function toggle(id: string) {
    if (multiple) {
      onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
    } else {
      onChange(selected.includes(id) ? [] : [id]);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {selectedPeople.length > 0 && <PeopleCluster people={selectedPeople} label={label} variant="spaced" max={8} />}
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} dir="auto" aria-label={label} />
      <ul role="listbox" aria-label={label} aria-multiselectable={multiple} className="flex max-h-60 flex-col gap-0.5 overflow-y-auto">
        {filtered.map((p) => {
          const isSelected = selected.includes(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => toggle(p.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[14px] px-3 py-2 text-start text-[14px] hover:bg-surface-elevated",
                  isSelected && "bg-surface-elevated",
                )}
              >
                <Avatar person={p} size="sm" />
                <span className="min-w-0 flex-1 truncate" dir="auto">
                  {p.name}
                </span>
                {isSelected && <span aria-hidden className="text-foreground-muted">✓</span>}
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && <li className="px-3 py-2 text-[13px] text-foreground-muted">{t("noMatches")}</li>}
      </ul>
    </div>
  );
}
