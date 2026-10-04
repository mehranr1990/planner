import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Panel, SectionHeader } from "@/components/ui/surface";
import { ProfileForm } from "@/features/account/components/settings-forms";
import { SettingsHeader } from "@/features/account/components/settings-header";
import { getViewer } from "@/server/context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("metaTitle") };
}

export default async function ProfileSettingsPage() {
  const viewer = await getViewer();
  const t = await getTranslations("settings.profile");
  return (
    <>
      <SettingsHeader />
      <div className="flex max-w-3xl flex-col gap-4">
        <Panel aria-labelledby="profile-heading">
          <SectionHeader title={<span id="profile-heading">{t("heading")}</span>} />
          <ProfileForm name={viewer.user.name} />
        </Panel>
      </div>
    </>
  );
}
