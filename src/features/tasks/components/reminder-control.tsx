"use client";

import { Bell, Pencil, X } from "lucide-react";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button, IconButton } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { useFormat } from "@/i18n/use-format";
import { localDate, localMinutes, type CalendarDate } from "@/lib/time";
import { removeReminderAction, setReminderAction } from "@/features/reminders/server/actions";
import type { ReminderDetail } from "@/features/reminders/types";

const RELATIVE_OPTIONS = [0, 1, 2, 3, 7] as const;

function toTimeInput(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function fromTimeInput(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function ReminderControl({
  taskId,
  reminder,
  dueOn,
  today,
  timezone,
  onError,
}: {
  taskId: string;
  reminder: ReminderDetail | null;
  /** The task's own due date, if any — enables the "N days before due" option. */
  dueOn: CalendarDate | null;
  today: CalendarDate;
  timezone: string;
  onError: (message: string | null) => void;
}) {
  const t = useTranslations("tasks.sheet.reminder");
  const f = useFormat();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState<ReminderDetail | null>(reminder);
  const [mode, setMode] = useState<"date" | "relative">(dueOn ? "relative" : "date");
  const existingInstant = local ? new Date(local.remindAt) : null;
  const [dateValue, setDateValue] = useState(existingInstant ? localDate(existingInstant, timezone) : today);
  const [timeValue, setTimeValue] = useState(existingInstant ? toTimeInput(localMinutes(existingInstant, timezone)) : "09:00");
  const [daysBefore, setDaysBefore] = useState(0);

  function submit() {
    onError(null);
    const remindTime = fromTimeInput(timeValue);
    const body = mode === "relative" && dueOn ? { kind: "relativeToDue" as const, taskId, daysBeforeDue: daysBefore, remindTime } : { kind: "absolute" as const, taskId, remindOn: dateValue, remindTime };
    start(async () => {
      const res = await setReminderAction(body);
      if (!res.ok) {
        onError(res.error ?? null);
        return;
      }
      setLocal({ remindAt: res.data.remindAt, delivered: false });
      setEditing(false);
    });
  }

  function remove() {
    onError(null);
    const previous = local;
    setLocal(null);
    start(async () => {
      const res = await removeReminderAction({ taskId });
      if (!res.ok) {
        onError(res.error ?? null);
        setLocal(previous);
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2 px-1">
        <Bell className="size-4 shrink-0 text-foreground-muted" aria-hidden />
        {local ? (
          <>
            <span className="min-w-0 flex-1 truncate text-[13px]">
              {t("remindOn", { day: f.relativeDay(localDate(new Date(local.remindAt), timezone), today), time: f.time(new Date(local.remindAt), timezone) })}
            </span>
            <IconButton label={t("edit")} size="sm" disabled={pending} onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" aria-hidden />
            </IconButton>
            <IconButton label={t("remove")} size="sm" disabled={pending} onClick={remove}>
              <X className="size-3.5" aria-hidden />
            </IconButton>
          </>
        ) : (
          <button type="button" className="text-[13px] text-foreground-muted hover:text-foreground" onClick={() => setEditing(true)}>
            {t("add")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-[16px] bg-surface-elevated p-3">
      {dueOn && (
        <Select value={mode} onChange={(e) => setMode(e.target.value as "date" | "relative")} aria-label={t("mode")}>
          <option value="relative">{t("modeRelative")}</option>
          <option value="date">{t("modeDate")}</option>
        </Select>
      )}
      <div className="flex gap-2">
        {mode === "relative" && dueOn ? (
          <Select value={daysBefore} onChange={(e) => setDaysBefore(Number(e.target.value))} aria-label={t("daysBefore")} className="min-w-0 flex-1">
            {RELATIVE_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {t("daysBeforeOption", { count: d })}
              </option>
            ))}
          </Select>
        ) : (
          <Input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value as CalendarDate)} aria-label={t("date")} className="min-w-0 flex-1" />
        )}
        <Input type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} aria-label={t("time")} className="w-28 shrink-0" />
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="primary" disabled={pending} onClick={submit}>
          {t("save")}
        </Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => setEditing(false)}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
