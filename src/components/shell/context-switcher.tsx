"use client";

import { Building2, Check, ChevronDown, Plus, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useTransition } from "react";
import { switchContextAction } from "@/features/workspace/server/actions";
import { cn } from "@/lib/cn";

export interface ContextOption {
  id: string;
  name: string;
}

/** Personal ↔ workspace switch. The server re-verifies membership on every switch. */
export function ContextSwitcher({ workspaces, activeId }: { workspaces: ContextOption[]; activeId: string | null }) {
  const router = useRouter();
  const t = useTranslations("navigation.context");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDetailsElement>(null);
  const active = workspaces.find((w) => w.id === activeId);

  const choose = (id: string | null) => {
    ref.current?.removeAttribute("open");
    if (id === activeId) return;
    start(async () => {
      const res = await switchContextAction({ workspaceId: id });
      if (res.ok) router.refresh();
    });
  };

  const item = (id: string | null, name: string, Icon: typeof User) => (
    <li key={id ?? "personal"}>
      <button
        type="button"
        onClick={() => choose(id)}
        className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-start text-sm hover:bg-surface-secondary"
      >
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-surface-secondary">
          <Icon className="size-3.5" aria-hidden />
        </span>
        <span className="flex-1 truncate">{name}</span>
        {id === activeId && <Check className="size-4 text-foreground-muted" aria-label={t("current")} />}
      </button>
    </li>
  );

  return (
    <details ref={ref} className="group relative">
      <summary
        className={cn(
          "flex h-10 cursor-pointer list-none items-center gap-2 rounded-full bg-surface-elevated ps-1.5 pe-3 text-sm ring-1 ring-border-subtle select-none hover:ring-border-strong [&::-webkit-details-marker]:hidden",
          pending && "opacity-60",
        )}
        aria-label={t("change", { name: active?.name ?? tc("personal") })}
      >
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-surface-active text-foreground-on-active">
          {active ? <Building2 className="size-3.5" aria-hidden /> : <User className="size-3.5" aria-hidden />}
        </span>
        <span className="max-w-[10rem] truncate font-medium">{active?.name ?? tc("personal")}</span>
        <ChevronDown className="size-4 text-foreground-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="animate-overlay absolute top-12 start-0 z-40 w-64 rounded-[20px] bg-surface-elevated p-2 shadow-overlay ring-1 ring-border-subtle">
        <ul className="flex flex-col gap-0.5">
          {item(null, tc("personal"), User)}
          {workspaces.map((w) => item(w.id, w.name, Building2))}
        </ul>
        <div className="mt-1 border-t border-border-subtle pt-1">
          <Link
            href="/settings#workspaces"
            onClick={() => ref.current?.removeAttribute("open")}
            className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm text-foreground-muted hover:bg-surface-secondary hover:text-foreground"
          >
            <span className="inline-flex size-7 items-center justify-center rounded-full ring-1 ring-border-subtle">
              <Plus className="size-3.5" aria-hidden />
            </span>
            {t("newWorkspace")}
          </Link>
        </div>
      </div>
    </details>
  );
}
