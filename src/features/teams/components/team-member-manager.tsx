"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/data-viz";
import { PeoplePicker } from "@/components/ui/people-picker";
import type { PersonRef } from "@/components/ui/people";
import { addTeamMemberAction, removeTeamMemberAction, setTeamLeadAction } from "../server/actions";

export function TeamMemberManager({
  teamId,
  members,
  candidates,
  canManage,
}: {
  teamId: string;
  members: { role: "LEAD" | "MEMBER"; user: PersonRef }[];
  candidates: PersonRef[];
  canManage: boolean;
}) {
  const t = useTranslations("workspace.teams");
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const memberIds = new Set(members.map((m) => m.user.id));
  const available = candidates.filter((c) => !memberIds.has(c.id));

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-1">
        {members.map((m) => (
          <li key={m.user.id} className="flex items-center justify-between gap-3 rounded-[16px] bg-surface-elevated px-4 py-3 ring-1 ring-border-subtle">
            <div className="flex items-center gap-3">
              <Avatar person={m.user} size="sm" />
              <span className="text-[14px] font-medium" dir="auto">
                {m.user.name}
              </span>
              {m.role === "LEAD" && <Chip tone="blue">{t("lead")}</Chip>}
            </div>
            {canManage && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => start(async () => { await setTeamLeadAction({ teamId, userId: m.user.id, isLead: m.role !== "LEAD" }); router.refresh(); })}
                >
                  {m.role === "LEAD" ? t("unsetLead") : t("setLead")}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={pending}
                  onClick={() => start(async () => { await removeTeamMemberAction({ teamId, userId: m.user.id }); router.refresh(); })}
                >
                  {t("removeMember")}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {canManage && available.length > 0 && (
        <div className="flex flex-col gap-3 rounded-[16px] bg-surface-elevated p-4 ring-1 ring-border-subtle">
          <PeoplePicker people={available} selected={picked} onChange={setPicked} label={t("addMember")} placeholder={t("searchMembers")} multiple={false} />
          <Button
            variant="primary"
            size="sm"
            className="self-start"
            disabled={picked.length === 0 || pending}
            onClick={() =>
              start(async () => {
                await addTeamMemberAction({ teamId, userId: picked[0]! });
                setPicked([]);
                router.refresh();
              })
            }
          >
            {t("addMember")}
          </Button>
        </div>
      )}
    </div>
  );
}
