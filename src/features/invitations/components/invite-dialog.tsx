"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { sendInvitationAction } from "../server/actions";

const ROLES = ["ADMIN", "MANAGER", "MEMBER", "GUEST"] as const;

export function InviteDialog({ workspaceId, canInviteGuests }: { workspaceId: string; canInviteGuests: boolean }) {
  const t = useTranslations("invitations");
  const tw = useTranslations("workspace.roles");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const roles = canInviteGuests ? ROLES : ROLES.filter((r) => r !== "GUEST");

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        {t("invite")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("inviteTitle")}>
        <form
          className="flex flex-col gap-4"
          action={(form) =>
            start(async () => {
              setError(null);
              const role = String(form.get("role")) as (typeof ROLES)[number];
              const res = await sendInvitationAction({
                workspaceId,
                email: String(form.get("email")),
                role,
                isExternal: role === "GUEST" && form.get("isExternal") === "on",
              });
              if (!res.ok) return setError(res.error);
              setOpen(false);
              router.refresh();
            })
          }
        >
          <Field label={t("email")} htmlFor="invite-email">
            <Input id="invite-email" name="email" type="email" dir="ltr" required maxLength={254} />
          </Field>
          <Field label={t("role")} htmlFor="invite-role">
            <Select id="invite-role" name="role" defaultValue="MEMBER">
              {roles.map((r) => (
                <option key={r} value={r}>
                  {tw(r)}
                </option>
              ))}
            </Select>
          </Field>
          {canInviteGuests && (
            <label className="flex items-center gap-2 ps-1 text-[13px] text-foreground-muted">
              <input type="checkbox" name="isExternal" className="size-4 rounded" />
              {t("externalCollaborator")}
            </label>
          )}
          {error && (
            <p role="alert" className="text-[12.5px] text-accent-red">
              {error}
            </p>
          )}
          <DialogFooter cancelLabel={t("cancel")} submitLabel={t("sendInvite")} onCancel={() => setOpen(false)} pending={pending} />
        </form>
      </Dialog>
    </>
  );
}
