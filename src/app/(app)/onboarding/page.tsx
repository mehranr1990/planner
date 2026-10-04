import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { OnboardingWizard } from "@/features/onboarding/components/onboarding-wizard";
import { getViewer } from "@/server/context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("metaTitle") };
}

export default async function OnboardingPage() {
  const viewer = await getViewer();
  if (viewer.user.isOnboarded) redirect("/home");
  const locale = await getLocale();

  const timezones = Intl.supportedValuesOf("timeZone");
  if (!timezones.includes(viewer.user.timezone)) timezones.unshift(viewer.user.timezone);
  const existingWorkspace = viewer.activeWorkspace ?? viewer.workspaces[0] ?? null;

  return (
    <OnboardingWizard
      name={viewer.user.name}
      timezone={viewer.user.timezone}
      weekStartsOn={viewer.user.weekStartsOn}
      locale={locale}
      timezones={timezones}
      existingWorkspace={existingWorkspace ? { id: existingWorkspace.id, name: existingWorkspace.name } : null}
    />
  );
}
