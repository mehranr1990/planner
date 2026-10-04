import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState, PageTitle, Panel, SectionHeader } from "@/components/ui/surface";
import { AuditLog } from "@/features/audit/components/audit-log";
import { listAuditEvents } from "@/features/audit/server/queries";
import { NoActiveWorkspace } from "@/features/workspace/components/no-active-workspace";
import { WorkspaceSettingsNav } from "@/features/workspace/components/workspace-settings-nav";
import { getViewer } from "@/server/context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("workspace.audit");
  return { title: t("metaTitle") };
}

export default async function WorkspaceAuditSettingsPage() {
  const viewer = await getViewer();
  const t = await getTranslations("workspace.audit");
  const ws = viewer.activeWorkspace;

  if (!ws) {
    return (
      <>
        <PageTitle>{t("metaTitle")}</PageTitle>
        <NoActiveWorkspace viewer={viewer} />
      </>
    );
  }

  const page = await listAuditEvents(viewer, ws.id);
  return (
    <>
      <PageTitle>{t("metaTitle")}</PageTitle>
      <WorkspaceSettingsNav />
      <div className="max-w-3xl">
        <Panel aria-labelledby="audit-heading">
          <SectionHeader title={<span id="audit-heading">{t("metaTitle")}</span>} />
          {page === null ? <EmptyState title={t("unavailableTitle")} /> : <AuditLog workspaceId={ws.id} initialEvents={page.events} initialCursor={page.nextCursor} timezone={viewer.user.timezone} />}
        </Panel>
      </div>
    </>
  );
}
