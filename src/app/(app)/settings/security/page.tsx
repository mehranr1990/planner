import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Panel, SectionHeader } from "@/components/ui/surface";
import { SettingsHeader } from "@/features/account/components/settings-header";
import { ChangePasswordForm } from "@/features/security/components/change-password-form";
import { SessionsList } from "@/features/security/components/sessions-list";
import { listSessions } from "@/features/security/server/queries";
import { getViewer } from "@/server/context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("metaTitle") };
}

export default async function SecuritySettingsPage() {
  const viewer = await getViewer();
  const [t, sessions] = await Promise.all([getTranslations("security"), listSessions(viewer)]);

  return (
    <>
      <SettingsHeader />
      <div className="flex max-w-3xl flex-col gap-4">
        <Panel aria-labelledby="password-heading">
          <SectionHeader title={<span id="password-heading">{t("password.heading")}</span>} />
          <ChangePasswordForm />
        </Panel>
        <Panel aria-labelledby="sessions-heading">
          <SectionHeader title={<span id="sessions-heading">{t("sessions.heading")}</span>} count={sessions.length} />
          <SessionsList sessions={sessions} timezone={viewer.user.timezone} />
        </Panel>
      </div>
    </>
  );
}
