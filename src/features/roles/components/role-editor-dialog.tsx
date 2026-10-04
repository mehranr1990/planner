"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { CAPABILITIES, type Capability } from "@/server/permissions/capabilities";
import { createCustomRoleAction, updateCustomRoleAction } from "../server/actions";

const BASE_ROLES = ["ADMIN", "MANAGER", "MEMBER", "GUEST"] as const;

function groupByModule(capabilities: readonly Capability[]): Record<string, Capability[]> {
  const groups: Record<string, Capability[]> = {};
  for (const c of capabilities) {
    const [module] = c.split(".");
    (groups[module!] ??= []).push(c);
  }
  return groups;
}

const MODULES = groupByModule(CAPABILITIES);

export function RoleEditorDialog({
  workspaceId,
  role,
  onClose,
}: {
  workspaceId: string;
  role: { id: string; name: string; baseRole: string; capabilities: string[] } | null;
  onClose: () => void;
}) {
  const t = useTranslations("workspace.roles");
  const tw = useTranslations("workspace.roles");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.capabilities ?? []));

  function toggle(cap: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cap)) next.delete(cap);
      else next.add(cap);
      return next;
    });
  }

  return (
    <Dialog open onClose={onClose} title={role ? t("editTitle") : t("createTitle")}>
      <form
        className="flex flex-col gap-4"
        action={(form) =>
          start(async () => {
            setError(null);
            const capabilities = Array.from(selected).filter((c): c is Capability => (CAPABILITIES as readonly string[]).includes(c));
            const res = role
              ? await updateCustomRoleAction({ roleId: role.id, name: String(form.get("name")), capabilities })
              : await createCustomRoleAction({ workspaceId, name: String(form.get("name")), baseRole: String(form.get("baseRole")) as (typeof BASE_ROLES)[number], capabilities });
            if (!res.ok) return setError(res.error);
            onClose();
            router.refresh();
          })
        }
      >
        <Field label={t("name")} htmlFor="role-name">
          <Input id="role-name" name="name" dir="auto" defaultValue={role?.name} required minLength={2} maxLength={60} />
        </Field>
        {!role && (
          <Field label={t("baseRole")} htmlFor="role-base">
            <Select id="role-base" name="baseRole" defaultValue="MEMBER">
              {BASE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {tw(r)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <fieldset className="flex flex-col gap-4">
          <legend className="ps-1 text-[12.5px] text-foreground-muted">{t("capabilities")}</legend>
          {Object.entries(MODULES).map(([module, caps]) => (
            <div key={module} className="flex flex-col gap-1.5">
              <p className="ps-1 text-[12px] font-medium text-foreground-subtle uppercase">{module}</p>
              {caps.map((cap) => (
                <label key={cap} className="flex items-center gap-2 rounded-[12px] px-2 py-1.5 text-[13.5px] hover:bg-surface-elevated">
                  <input type="checkbox" className="size-4 rounded" checked={selected.has(cap)} onChange={() => toggle(cap)} />
                  <span dir="ltr">{cap}</span>
                </label>
              ))}
            </div>
          ))}
        </fieldset>
        {error && (
          <p role="alert" className="text-[12.5px] text-accent-red">
            {error}
          </p>
        )}
        <DialogFooter cancelLabel={t("cancel")} submitLabel={t("save")} onCancel={onClose} pending={pending} />
      </form>
    </Dialog>
  );
}
