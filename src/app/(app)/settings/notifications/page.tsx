import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState, Panel } from "@/components/ui/surface";
import { SettingsHeader } from "@/features/account/components/settings-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("metaTitle") };
}

export default async function NotificationsSettingsPage() {
  const t = await getTranslations("settings.notifications");
  return (
    <>
      <SettingsHeader />
      <div className="flex max-w-3xl flex-col gap-4">
        <Panel>
          <EmptyState title={t("comingSoonTitle")} hint={t("comingSoonHint")} />
        </Panel>
      </div>
    </>
  );
}
