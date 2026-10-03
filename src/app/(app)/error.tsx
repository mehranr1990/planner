"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/surface";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  return (
    <Panel className="mx-auto mt-10 max-w-lg text-center">
      <h1 className="text-[20px] font-medium">{t("states.errorTitle")}</h1>
      <p className="mt-2 text-[13px] text-foreground-muted">{t("states.errorBody")}</p>
      <Button variant="primary" className="mt-6" onClick={reset}>
        {t("actions.retry")}
      </Button>
    </Panel>
  );
}
