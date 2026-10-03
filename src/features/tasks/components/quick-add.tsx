"use client";

import { ArrowUp, Calendar, Clock, Flag, Moon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Chip } from "@/components/ui/data-viz";
import { useFormat } from "@/i18n/use-format";
import { cn } from "@/lib/cn";
import type { CalendarDate } from "@/lib/time";
import { parseQuickAdd } from "../domain/quick-add";
import { createTaskAction } from "../server/actions";

export interface QuickAddContext {
  value: string; // "personal" | workspaceId
  label: string;
}

/**
 * Compact natural-language task capture. The preview uses the same pure parser the server runs,
 * but the server re-parses — the client's interpretation is never trusted.
 * Parser language: English keywords only (see docs/ARCHITECTURE.md → i18n). The UI is localized;
 * titles in any script pass through untouched.
 */
export function QuickAdd({
  today,
  contexts,
  defaultContext,
  projectId = null,
  view = null,
  placeholder,
}: {
  today: CalendarDate;
  contexts: QuickAddContext[];
  defaultContext: string;
  projectId?: string | null;
  view?: string | null;
  placeholder?: string;
}) {
  const t = useTranslations("tasks");
  const f = useFormat();
  const [text, setText] = useState("");
  const [context, setContext] = useState(defaultContext);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => parseQuickAdd(text, today), [text, today]);

  useEffect(() => {
    if (window.location.hash === "#quick-add") inputRef.current?.focus();
  }, []);

  const submit = () => {
    const input = text.trim();
    if (!input || pending) return;
    setError(null);
    // One id per submission: a double click or retry resolves to the same task server-side.
    const clientMutationId = crypto.randomUUID();
    start(async () => {
      const res = await createTaskAction({ input, clientMutationId, context, projectId, view });
      if (res.ok) setText("");
      else setError(res.error);
    });
  };

  return (
    <div id="quick-add" className="scroll-mt-24">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={cn(
          "flex items-center gap-2 rounded-[22px] bg-surface-elevated p-2 ps-5 ring-1 ring-border-subtle transition-shadow focus-within:ring-border-strong",
          pending && "opacity-70",
        )}
      >
        <label htmlFor="quick-add-input" className="sr-only">
          {t("quickAdd.label")}
        </label>
        <input
          ref={inputRef}
          id="quick-add-input"
          dir="auto"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder ?? t("quickAdd.placeholder")}
          autoComplete="off"
          maxLength={500}
          aria-describedby={error ? "quick-add-error" : "quick-add-preview"}
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] placeholder:text-foreground-subtle focus:outline-none"
        />
        {!projectId && contexts.length > 1 && (
          <>
            <label htmlFor="quick-add-context" className="sr-only">
              {t("quickAdd.space")}
            </label>
            <select
              id="quick-add-context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="hidden h-9 max-w-[9rem] truncate rounded-full bg-surface-secondary px-3 text-[13px] focus:outline-none sm:block"
            >
              {contexts.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </>
        )}
        <button
          type="submit"
          disabled={!text.trim() || pending}
          aria-label={t("quickAdd.submit")}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-active text-foreground-on-active transition-opacity disabled:opacity-30"
        >
          <ArrowUp className="size-[18px]" aria-hidden />
        </button>
      </form>
      <div id="quick-add-preview" aria-live="polite" className="flex min-h-8 flex-wrap items-center gap-1.5 px-3 pt-2">
        {error ? (
          <p id="quick-add-error" role="alert" className="text-[12.5px] text-accent-red">
            {error}
          </p>
        ) : (
          <>
            {parsed.dueOn && (
              <Chip tone="blue">
                <Calendar className="size-3" aria-hidden /> {f.date(parsed.dueOn, { weekday: "short", month: "short", day: "numeric" })}
              </Chip>
            )}
            {parsed.dueTime !== null && (
              <Chip tone="blue">
                <Clock className="size-3" aria-hidden /> {f.minutes(parsed.dueTime)}
              </Chip>
            )}
            {parsed.priority && (
              <Chip tone={parsed.priority === "URGENT" || parsed.priority === "HIGH" ? "red" : "yellow"}>
                <Flag className="size-3" aria-hidden /> {t(`priority.${parsed.priority}`)}
              </Chip>
            )}
            {parsed.isSomeday && (
              <Chip tone="slate">
                <Moon className="size-3" aria-hidden /> {t("quickAdd.someday")}
              </Chip>
            )}
          </>
        )}
      </div>
    </div>
  );
}
