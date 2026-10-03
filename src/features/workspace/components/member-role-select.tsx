"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { changeMemberRoleAction } from "../server/actions";

type Role = "OWNER" | "ADMIN" | "MANAGER" | "MEMBER" | "GUEST";

export function MemberRoleSelect({ workspaceId, userId, role, options, name }: { workspaceId: string; userId: string; role: Role; options: Role[]; name: string }) {
  const t = useTranslations("workspace");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (options.length === 0) return <span className="text-[13px] text-foreground-muted">{t(`roles.${role}`)}</span>;
  return (
    <span className="flex flex-col items-end">
      <label htmlFor={`role-${userId}`} className="sr-only">
        {t("roleFor", { name })}
      </label>
      <select
        id={`role-${userId}`}
        defaultValue={role}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            setError(null);
            const res = await changeMemberRoleAction({ workspaceId, userId, role: e.target.value as Role });
            if (!res.ok) setError(res.error);
          })
        }
        className="h-9 rounded-full bg-surface-secondary px-3 text-[13px] focus:outline-none"
      >
        {[role, ...options].map((r) => (
          <option key={r} value={r}>
            {t(`roles.${r}`)}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="mt-1 text-[12px] text-accent-red">
          {error}
        </span>
      )}
    </span>
  );
}
