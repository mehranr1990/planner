import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PeopleCluster } from "@/components/ui/people-cluster";
import { Card, EmptyState, PageTitle, Panel, SectionHeader } from "@/components/ui/surface";
import { CreateTeamDialog } from "@/features/teams/components/create-team-dialog";
import { listTeams } from "@/features/teams/server/queries";
import { NoActiveWorkspace } from "@/features/workspace/components/no-active-workspace";
import { TeamNav } from "@/features/workspace/components/team-nav";
import { actorIn, getViewer } from "@/server/context";
import { can } from "@/server/permissions/capabilities";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("workspace.teams");
  return { title: t("metaTitle") };
}

export default async function TeamsPage() {
  const viewer = await getViewer();
  const t = await getTranslations("workspace.teams");
  const ws = viewer.activeWorkspace;

  if (!ws) {
    return (
      <>
        <PageTitle>{t("metaTitle")}</PageTitle>
        <NoActiveWorkspace viewer={viewer} />
      </>
    );
  }

  const teams = await listTeams(viewer, ws.id);
  const canManage = can(actorIn(viewer, ws.id), "teams.manage");

  return (
    <>
      <PageTitle>{t("metaTitle")}</PageTitle>
      <TeamNav />
      <Panel aria-labelledby="teams-heading">
        <SectionHeader title={<span id="teams-heading">{t("metaTitle")}</span>} count={teams?.length} actions={canManage && <CreateTeamDialog workspaceId={ws.id} />} />
        {teams === null ? (
          <EmptyState title={t("unavailableTitle")} />
        ) : teams.length === 0 ? (
          <EmptyState title={t("emptyTitle")} hint={t("emptyHint")} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((team) => (
              <Link key={team.id} href={`/team/teams/${team.id}`}>
                <Card className="transition-shadow hover:ring-border-strong">
                  <p className="truncate text-[15px] font-medium" dir="auto">
                    {team.name}
                  </p>
                  {team.description && (
                    <p className="mt-1 truncate text-[13px] text-foreground-muted" dir="auto">
                      {team.description}
                    </p>
                  )}
                  {team.members.length > 0 && (
                    <div className="mt-3">
                      <PeopleCluster people={team.members} label={team.name} max={5} size="sm" />
                    </div>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
