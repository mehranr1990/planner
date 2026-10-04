"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/data-viz";
import { EmptyState } from "@/components/ui/surface";
import { useFormat } from "@/i18n/use-format";
import { revokeOtherSessionsAction, revokeSessionAction } from "../server/actions";

export interface SessionRow {
  id: string;
  userAgent: string | null;
  lastSeenAt: string;
  isCurrent: boolean;
}

export function SessionsList({ sessions, timezone }: { sessions: SessionRow[]; timezone: string }) {
  const t = useTranslations("security.sessions");
  const format = useFormat();
  const router = useRouter();
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const others = sessions.filter((s) => !s.isCurrent);

  if (sessions.length === 0) return <EmptyState title={t("emptyTitle")} />;

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-1">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 rounded-[16px] bg-surface-elevated px-4 py-3 ring-1 ring-border-subtle">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium" dir="ltr">
                {s.userAgent ?? t("unknownDevice")}
              </p>
              <p className="text-[12.5px] text-foreground-muted">{t("lastActive", { when: format.dateTime(new Date(s.lastSeenAt), timezone) })}</p>
            </div>
            {s.isCurrent ? (
              <Chip tone="green">{t("current")}</Chip>
            ) : (
              <Button variant="danger" size="sm" onClick={() => setRevoking(s.id)}>
                {t("revoke")}
              </Button>
            )}
          </li>
        ))}
      </ul>

      {others.length > 0 && (
        <Button variant="secondary" size="sm" className="self-start" onClick={() => setRevokingAll(true)}>
          {t("revokeAllOthers")}
        </Button>
      )}

      <ConfirmDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title={t("revokeTitle")}
        reason={t("revokeReason")}
        confirmLabel={t("revoke")}
        onConfirm={async () => {
          if (revoking) await revokeSessionAction({ sessionId: revoking });
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={revokingAll}
        onClose={() => setRevokingAll(false)}
        title={t("revokeAllTitle")}
        reason={t("revokeAllReason")}
        confirmLabel={t("revokeAllOthers")}
        onConfirm={async () => {
          await revokeOtherSessionsAction();
          router.refresh();
        }}
      />
    </div>
  );
}
