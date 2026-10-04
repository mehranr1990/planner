"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/data-viz";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/surface";
import { deleteCustomRoleAction } from "../server/actions";
import { RoleEditorDialog } from "./role-editor-dialog";

export interface CustomRoleRow {
  id: string;
  name: string;
  baseRole: "OWNER" | "ADMIN" | "MANAGER" | "MEMBER" | "GUEST";
  capabilities: string[];
  memberCount: number;
}

export function RolesManager({ workspaceId, roles }: { workspaceId: string; roles: CustomRoleRow[] }) {
  const t = useTranslations("workspace.roles");
  const tw = useTranslations("workspace.roles");
  const router = useRouter();
  const [editing, setEditing] = useState<CustomRoleRow | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<CustomRoleRow | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <Button variant="primary" size="sm" className="self-start" onClick={() => setEditing(null)}>
        {t("create")}
      </Button>
      {roles.length === 0 ? (
        <EmptyState title={t("emptyTitle")} hint={t("emptyHint")} />
      ) : (
        <ul className="flex flex-col gap-1">
          {roles.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 rounded-[16px] bg-surface-elevated px-4 py-3 ring-1 ring-border-subtle">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium" dir="auto">
                  {r.name}
                </p>
                <p className="text-[12.5px] text-foreground-muted">
                  {tw(r.baseRole)} · {t("memberCount", { count: r.memberCount })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Chip tone="slate">{t("capabilityCount", { count: r.capabilities.length })}</Chip>
                <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>
                  {t("edit")}
                </Button>
                <Button variant="danger" size="sm" onClick={() => setDeleting(r)}>
                  {t("delete")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing !== undefined && <RoleEditorDialog workspaceId={workspaceId} role={editing} onClose={() => setEditing(undefined)} />}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t("deleteTitle", { name: deleting?.name ?? "" })}
        reason={t("deleteReason")}
        confirmLabel={t("delete")}
        onConfirm={async () => {
          if (deleting) await deleteCustomRoleAction({ roleId: deleting.id });
          router.refresh();
        }}
      />
    </div>
  );
}
