import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageTitle, Panel, SectionHeader, EmptyState } from "@/components/ui/surface";
import { InviteDialog } from "@/features/invitations/components/invite-dialog";
import { InvitationRow } from "@/features/invitations/components/invitation-row";
import { listInvitations } from "@/features/invitations/server/queries";
import { NoActiveWorkspace } from "@/features/workspace/components/no-active-workspace";
import { TeamNav } from "@/features/workspace/components/team-nav";
import { can } from "@/server/permissions/capabilities";
import { actorIn, getViewer } from "@/server/context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invitations");
  return { title: t("metaTitle") };
}

export default async function InvitationsPage() {
  const viewer = await getViewer();
  const t = await getTranslations("invitations");
  const ws = viewer.activeWorkspace;

  if (!ws) {
    return (
      <>
        <PageTitle>{t("metaTitle")}</PageTitle>
        <NoActiveWorkspace viewer={viewer} />
      </>
    );
  }

  const invitations = await listInvitations(viewer, ws.id);
  const actor = actorIn(viewer, ws.id);
  const canInvite = can(actor, "members.invite");

  return (
    <>
      <PageTitle>{t("metaTitle")}</PageTitle>
      <TeamNav />
      <Panel aria-labelledby="invitations-heading">
        <SectionHeader
          title={<span id="invitations-heading">{t("metaTitle")}</span>}
          count={invitations?.length}
          actions={canInvite && <InviteDialog workspaceId={ws.id} canInviteGuests={can(actor, "guests.invite")} />}
        />
        {invitations === null ? (
          <EmptyState title={t("unavailableTitle")} />
        ) : invitations.length === 0 ? (
          <EmptyState title={t("emptyTitle")} hint={t("emptyHint")} />
        ) : (
          <ul className="flex flex-col gap-1">
            {invitations.map((i) => (
              <InvitationRow key={i.id} invitation={i} />
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
