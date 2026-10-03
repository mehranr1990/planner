import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { PeopleCluster } from "@/components/ui/people-cluster";
import { EmptyState, PageTitle, Panel, SectionHeader } from "@/components/ui/surface";
import { MemberRoleSelect } from "@/features/workspace/components/member-role-select";
import { listMembers } from "@/features/workspace/server/queries";
import { getViewer } from "@/server/context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("workspace");
  return { title: t("metaTitle") };
}

export default async function TeamPage() {
  const viewer = await getViewer();
  const [t, tc] = await Promise.all([getTranslations("workspace"), getTranslations("common")]);
  const ws = viewer.activeWorkspace;

  if (!ws) {
    const hasWorkspaces = viewer.workspaces.length > 0;
    return (
      <>
        <PageTitle>{t("title")}</PageTitle>
        <Panel>
          <EmptyState
            title={hasWorkspaces ? t("personalTitle") : t("noneTitle")}
            hint={hasWorkspaces ? t("personalHint") : t("noneHint")}
            action={
              <ButtonLink href="/settings#workspaces" variant="primary">
                {hasWorkspaces ? t("personalAction") : t("noneAction")}
              </ButtonLink>
            }
          />
        </Panel>
      </>
    );
  }

  const members = await listMembers(viewer, ws.id);
  return (
    <>
      <PageTitle>
        <span dir="auto">{ws.name}</span>
      </PageTitle>
      <Panel aria-labelledby="members-heading">
        <SectionHeader
          title={<span id="members-heading">{t("members")}</span>}
          count={members?.length}
          actions={members && <PeopleCluster people={members.map((m) => m.user)} max={5} size="sm" label={t("membersPreview")} />}
        />
        {members === null ? (
          <EmptyState title={t("directoryUnavailableTitle")} hint={t("directoryUnavailableHint")} />
        ) : (
          <ul className="flex flex-col">
            {members.map((m, i) => (
              <li key={m.user.id} className="animate-rise flex items-center gap-4 rounded-[18px] px-3 py-3 hover:bg-surface-elevated" style={{ "--i": i } as React.CSSProperties}>
                <Avatar person={m.user} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-medium">
                    <span dir="auto">{m.user.name}</span>
                    {m.user.id === viewer.user.id && <span className="ms-2 text-[12px] font-normal text-foreground-muted">{tc("you")}</span>}
                  </p>
                  {/* IANA identifiers are data, not copy; shown as-is (LTR). */}
                  <p className="text-[12.5px] text-foreground-muted" dir="ltr">
                    {m.user.timezone.replaceAll("_", " ")}
                  </p>
                </div>
                <MemberRoleSelect workspaceId={ws.id} userId={m.user.id} role={m.role} options={m.assignableRoles} name={m.user.name} />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 px-3 text-[12.5px] text-foreground-subtle">{t("invitesNote")}</p>
      </Panel>
    </>
  );
}
