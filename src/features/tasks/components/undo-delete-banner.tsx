"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { restoreTaskAction } from "../server/actions";

export function UndoDeleteBanner({ taskId }: { taskId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dismiss = () => {
    const next = new URLSearchParams(params);
    next.delete("deleted");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div role="status" className="animate-rise fixed inset-x-4 bottom-28 z-40 mx-auto flex max-w-md items-center gap-3 rounded-full bg-surface-active py-2 ps-5 pe-2 text-sm text-foreground-on-active shadow-overlay lg:bottom-8">
      <span className="flex-1">{error ?? t("tasks.deletedBanner")}</span>
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await restoreTaskAction({ taskId });
            if (res.ok) dismiss();
            else setError(res.error);
          })
        }
      >
        {t("common.actions.undo")}
      </Button>
      <button type="button" onClick={dismiss} className="h-8 rounded-full px-3 text-[13px] opacity-70 hover:opacity-100">
        {t("common.actions.dismiss")}
      </button>
    </div>
  );
}
