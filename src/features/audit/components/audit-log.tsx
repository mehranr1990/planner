"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/surface";
import { useFormat } from "@/i18n/use-format";
import { listAuditEventsAction } from "../server/actions";

export interface AuditEventRow {
  id: string;
  action: string;
  targetType: string;
  createdAt: string;
  actor: { id: string; name: string; avatarUrl: string | null } | null;
}

export function AuditLog({ workspaceId, initialEvents, initialCursor, timezone }: { workspaceId: string; initialEvents: AuditEventRow[]; initialCursor: string | null; timezone: string }) {
  const t = useTranslations("workspace.audit");
  const format = useFormat();
  const [events, setEvents] = useState(initialEvents);
  const [cursor, setCursor] = useState(initialCursor);
  const [pending, start] = useTransition();

  if (events.length === 0) return <EmptyState title={t("emptyTitle")} />;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1">
        {events.map((e) => (
          <li key={e.id} className="flex items-center gap-3 rounded-[16px] bg-surface-elevated px-4 py-3 ring-1 ring-border-subtle">
            {e.actor ? <Avatar person={e.actor} size="sm" /> : <div className="size-8 shrink-0 rounded-full bg-surface-secondary" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px]">
                <span className="font-medium" dir="auto">
                  {e.actor?.name ?? t("system")}
                </span>{" "}
                <span className="text-foreground-muted" dir="ltr">
                  {e.action}
                </span>
              </p>
              <p className="text-[12px] text-foreground-muted">{format.dateTime(new Date(e.createdAt), timezone)}</p>
            </div>
          </li>
        ))}
      </ul>
      {cursor && (
        <Button
          variant="secondary"
          size="sm"
          className="self-center"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await listAuditEventsAction({ workspaceId, cursor });
              if (res.ok) {
                setEvents((prev) => [...prev, ...res.data.events]);
                setCursor(res.data.nextCursor);
              }
            })
          }
        >
          {t("loadMore")}
        </Button>
      )}
    </div>
  );
}
