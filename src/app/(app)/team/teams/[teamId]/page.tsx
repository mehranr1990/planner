import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageTitle, Panel, SectionHeader } from "@/components/ui/surface";
import { ArchiveTeamButton } from "@/features/teams/components/archive-team-button";
import { TeamMemberManager } from "@/features/teams/components/team-member-manager";
import { getTeam } from "@/features/teams/server/queries";
import { listMembers } from "@/features/workspace/server/queries";
import { actorIn, getViewer } from "@/server/context";
import { can } from "@/server/permissions/capabilities";

export async function generateMetadata({ params }: PageProps<"/team/teams/[teamId]">): Promise<Metadata> {
  const { teamId } = await params;
  const viewer = await getViewer();
  const team = await getTeam(viewer, teamId);
  return { title: team?.name ?? "Team" };
}

export default async function TeamDetailPage({ params }: PageProps<"/team/teams/[teamId]">) {
  const { teamId } = await params;
  const viewer = await getViewer();
  const team = await getTeam(viewer, teamId);
  if (!team || team.archivedAt) notFound();

  const t = await getTranslations("workspace.teams");
  const actor = actorIn(viewer, team.workspaceId);
  const canManage = can(actor, "teams.manage");
  const candidates = canManage ? ((await listMembers(viewer, team.workspaceId)) ?? []).map((m) => m.user) : [];

  return (
    <>
      <PageTitle actions={canManage && <ArchiveTeamButton teamId={team.id} />}>
        <span dir="auto">{team.name}</span>
      </PageTitle>
      <Panel aria-labelledby="team-members-heading">
        <SectionHeader title={<span id="team-members-heading">{t("members")}</span>} count={team.members.length} />
        <TeamMemberManager teamId={team.id} members={team.members} candidates={candidates} canManage={canManage} />
      </Panel>
    </>
  );
}
