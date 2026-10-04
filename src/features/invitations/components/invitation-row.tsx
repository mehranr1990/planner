"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/data-viz";
import { useFormat } from "@/i18n/use-format";
import { calendarDate } from "@/lib/time";
import { resendInvitationAction, revokeInvitationAction } from "../server/actions";

export interface InvitationRowData {
  id: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MANAGER" | "MEMBER" | "GUEST";
  isExternal: boolean;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
}

const STATUS_TONE = { PENDING: "yellow", ACCEPTED: "green", REVOKED: "slate", EXPIRED: "red" } as const;

export function InvitationRow({ invitation }: { invitation: InvitationRowData }) {
  const t = useTranslations("invitations");
  const tw = useTranslations("workspace.roles");
  const format = useFormat();
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <li className="flex items-center justify-between gap-3 rounded-[16px] bg-surface-elevated px-4 py-3 ring-1 ring-border-subtle">
      <div className="min-w-0">
        <p className="truncate text-[14px] font-medium" dir="ltr">
          {invitation.email}
        </p>
        <p className="text-[12.5px] text-foreground-muted">
          {tw(invitation.role)}
          {invitation.status === "PENDING" && ` · ${t("expiresOn", { date: format.date(calendarDate(invitation.expiresAt.slice(0, 10))) })}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Chip tone={STATUS_TONE[invitation.status]}>{t(`status.${invitation.status}`)}</Chip>
        {invitation.status === "PENDING" && (
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => start(async () => { await resendInvitationAction({ invitationId: invitation.id }); router.refresh(); })}
            >
              {t("resend")}
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() => start(async () => { await revokeInvitationAction({ invitationId: invitation.id }); router.refresh(); })}
            >
              {t("revoke")}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
