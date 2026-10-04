import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Panel, SectionHeader } from "@/components/ui/surface";
import { PreferencesForm } from "@/features/account/components/settings-forms";
import { SettingsHeader } from "@/features/account/components/settings-header";
import { getViewer } from "@/server/context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("metaTitle") };
}

export default async function PreferencesSettingsPage() {
  const viewer = await getViewer();
  const t = await getTranslations("settings.prefs");
  const timezones = Intl.supportedValuesOf("timeZone");
  if (!timezones.includes(viewer.user.timezone)) timezones.unshift(viewer.user.timezone);

  return (
    <>
      <SettingsHeader />
      <div className="flex max-w-3xl flex-col gap-4">
        <Panel aria-labelledby="prefs-heading">
          <SectionHeader title={<span id="prefs-heading">{t("heading")}</span>} />
          <PreferencesForm timezone={viewer.user.timezone} weekStartsOn={viewer.user.weekStartsOn} timezones={timezones} />
        </Panel>
      </div>
    </>
  );
}
