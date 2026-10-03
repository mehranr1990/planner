import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/surface";

// Unmatched URLs outside the app shell.
export default function RootNotFound() {
  const t = useTranslations("common");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <Panel className="w-full max-w-lg text-center">
        <h1 className="text-[20px] font-medium">{t("states.notFoundTitle")}</h1>
        <p className="mt-2 text-[13px] text-foreground-muted">{t("states.notFoundBody")}</p>
        <ButtonLink href="/home" variant="primary" className="mt-6">
          {t("actions.goHome")}
        </ButtonLink>
      </Panel>
    </main>
  );
}
