import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState, PageTitle, Panel, SectionHeader } from "@/components/ui/surface";
import { RolesManager } from "@/features/roles/components/roles-manager";
import { listCustomRoles } from "@/features/roles/server/queries";
import { NoActiveWorkspace } from "@/features/workspace/components/no-active-workspace";
import { WorkspaceSettingsNav } from "@/features/workspace/components/workspace-settings-nav";
import { getViewer } from "@/server/context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("workspace.roles");
  return { title: t("metaTitle") };
}

export default async function WorkspaceRolesSettingsPage() {
  const viewer = await getViewer();
  const t = await getTranslations("workspace.roles");
  const ws = viewer.activeWorkspace;

  if (!ws) {
    return (
      <>
        <PageTitle>{t("metaTitle")}</PageTitle>
        <NoActiveWorkspace viewer={viewer} />
      </>
    );
  }

  const roles = await listCustomRoles(viewer, ws.id);
  return (
    <>
      <PageTitle>{t("metaTitle")}</PageTitle>
      <WorkspaceSettingsNav />
      <div className="max-w-3xl">
        <Panel aria-labelledby="roles-heading">
          <SectionHeader title={<span id="roles-heading">{t("metaTitle")}</span>} count={roles?.length} />
          {roles === null ? <EmptyState title={t("unavailableTitle")} /> : <RolesManager workspaceId={ws.id} roles={roles} />}
        </Panel>
      </div>
    </>
  );
}
