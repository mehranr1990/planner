import { getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/ui/surface";
import { SettingsNav } from "./settings-nav";

export async function SettingsHeader() {
  const t = await getTranslations("settings");
  return (
    <>
      <PageTitle>{t("title")}</PageTitle>
      <SettingsNav />
    </>
  );
}
