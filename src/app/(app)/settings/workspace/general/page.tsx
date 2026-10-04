import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState, PageTitle, Panel, SectionHeader } from "@/components/ui/surface";
import { NoActiveWorkspace } from "@/features/workspace/components/no-active-workspace";
import { WorkspaceSettingsForm } from "@/features/workspace/components/workspace-settings-form";
import { WorkspaceSettingsNav } from "@/features/workspace/components/workspace-settings-nav";
import { actorIn, getViewer } from "@/server/context";
import { can } from "@/server/permissions/capabilities";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("workspace.general");
  return { title: t("metaTitle") };
}

export default async function WorkspaceGeneralSettingsPage() {
  const viewer = await getViewer();
  const t = await getTranslations("workspace.general");
  const ws = viewer.activeWorkspace;

  if (!ws) {
    return (
      <>
        <PageTitle>{t("metaTitle")}</PageTitle>
        <NoActiveWorkspace viewer={viewer} />
      </>
    );
  }

  const canManage = can(actorIn(viewer, ws.id), "workspace.manage");

  return (
    <>
      <PageTitle>{t("metaTitle")}</PageTitle>
      <WorkspaceSettingsNav />
      <div className="max-w-3xl">
        <Panel aria-labelledby="ws-general-heading">
          <SectionHeader title={<span id="ws-general-heading">{t("heading")}</span>} />
          {canManage ? (
            <WorkspaceSettingsForm workspaceId={ws.id} name={ws.name} iconUrl={ws.iconUrl} timezone={ws.timezone} />
          ) : (
            <EmptyState title={t("forbiddenTitle")} hint={t("forbiddenHint")} />
          )}
        </Panel>
      </div>
    </>
  );
}
