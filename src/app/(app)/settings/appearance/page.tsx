import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Panel, SectionHeader } from "@/components/ui/surface";
import { AppearanceForm } from "@/features/account/components/settings-forms";
import { SettingsHeader } from "@/features/account/components/settings-header";
import { getViewer } from "@/server/context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("metaTitle") };
}

export default async function AppearanceSettingsPage() {
  const viewer = await getViewer();
  const t = await getTranslations("settings.appearance");
  return (
    <>
      <SettingsHeader />
      <div className="flex max-w-3xl flex-col gap-4">
        <Panel aria-labelledby="appearance-heading">
          <SectionHeader title={<span id="appearance-heading">{t("heading")}</span>} />
          <AppearanceForm theme={viewer.user.theme} />
        </Panel>
      </div>
    </>
  );
}
