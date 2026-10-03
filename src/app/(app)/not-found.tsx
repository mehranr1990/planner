import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/surface";

// Used for both "doesn't exist" and "no access" so private objects can't be probed.
export default function NotFound() {
  const t = useTranslations("common");
  return (
    <Panel className="mx-auto mt-10 max-w-lg text-center">
      <h1 className="text-[20px] font-medium">{t("states.notFoundTitle")}</h1>
      <p className="mt-2 text-[13px] text-foreground-muted">{t("states.notFoundBody")}</p>
      <ButtonLink href="/home" variant="primary" className="mt-6">
        {t("actions.goHome")}
      </ButtonLink>
    </Panel>
  );
}
