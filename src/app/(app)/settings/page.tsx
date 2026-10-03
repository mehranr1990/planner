import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Chip } from "@/components/ui/data-viz";
import { PageTitle, Panel, SectionHeader } from "@/components/ui/surface";
import { CreateWorkspaceForm, PreferencesForm } from "@/features/account/components/settings-forms";
import { getViewer } from "@/server/context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("metaTitle") };
}

export default async function SettingsPage() {
  const viewer = await getViewer();
  const [t, tw, locale] = await Promise.all([getTranslations("settings"), getTranslations("workspace"), getLocale()]);
  const timezones = Intl.supportedValuesOf("timeZone");
  if (!timezones.includes(viewer.user.timezone)) timezones.unshift(viewer.user.timezone);

  return (
    <>
      <PageTitle>{t("title")}</PageTitle>
      <div className="flex max-w-3xl flex-col gap-4">
        <Panel aria-labelledby="prefs-heading">
          <SectionHeader title={<span id="prefs-heading">{t("prefs.heading")}</span>} />
          <PreferencesForm
            name={viewer.user.name}
            timezone={viewer.user.timezone}
            weekStartsOn={viewer.user.weekStartsOn}
            theme={viewer.user.theme}
            locale={locale}
            timezones={timezones}
          />
        </Panel>

        <Panel id="workspaces" aria-labelledby="ws-heading" className="scroll-mt-24">
          <SectionHeader title={<span id="ws-heading">{t("workspaces.heading")}</span>} count={viewer.workspaces.length} />
          {viewer.workspaces.length > 0 && (
            <ul className="mb-6 flex flex-col gap-1">
              {viewer.workspaces.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 rounded-[16px] bg-surface-elevated px-4 py-3 ring-1 ring-border-subtle">
                  <span className="truncate font-medium" dir="auto">
                    {w.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {viewer.activeWorkspace?.id === w.id && <Chip tone="blue">{t("workspaces.active")}</Chip>}
                    <Chip tone="slate">{tw(`roles.${w.actor.role}`)}</Chip>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <CreateWorkspaceForm timezone={viewer.user.timezone} />
        </Panel>

        <Panel aria-labelledby="account-heading">
          <SectionHeader title={<span id="account-heading">{t("account.heading")}</span>} />
          <p className="text-[13px] leading-6 text-foreground-muted">
            {t.rich("account.signedInAs", {
              email: viewer.user.email,
              value: (chunks) => (
                <span className="text-foreground" dir="ltr">
                  {chunks}
                </span>
              ),
            })}
          </p>
        </Panel>
      </div>
    </>
  );
}
