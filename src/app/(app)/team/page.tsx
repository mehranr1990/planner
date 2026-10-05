import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { PeopleCluster } from "@/components/ui/people-cluster";
import { EmptyState, PageTitle, Panel, SectionHeader } from "@/components/ui/surface";
import { MemberActions } from "@/features/workspace/components/member-actions";
import { MemberRoleSelect } from "@/features/workspace/components/member-role-select";
import { NoActiveWorkspace } from "@/features/workspace/components/no-active-workspace";
import { TeamNav } from "@/features/workspace/components/team-nav";
import { listMembers } from "@/features/workspace/server/queries";
import { getViewer } from "@/server/context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("workspace");
  return { title: t("metaTitle") };
}

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const viewer = await getViewer();
  const { status: statusParam } = await searchParams;
  const status = statusParam === "deactivated" ? "DEACTIVATED" : "ACTIVE";
  const [t, tc] = await Promise.all([getTranslations("workspace"), getTranslations("common")]);
  const ws = viewer.activeWorkspace;

  if (!ws) {
    return (
      <>
        <PageTitle>{t("title")}</PageTitle>
        <NoActiveWorkspace viewer={viewer} />
      </>
    );
  }

  const members = await listMembers(viewer, ws.id, status);
  return (
    <>
      <PageTitle>
        <span dir="auto">{ws.name}</span>
      </PageTitle>
      <TeamNav />
      <Panel aria-labelledby="members-heading">
        <SectionHeader
          title={<span id="members-heading">{t("members")}</span>}
          count={members?.length}
          actions={
            <>
              {members && <PeopleCluster people={members.map((m) => m.user)} max={5} size="sm" label={t("membersPreview")} />}
              <ButtonLink href={status === "ACTIVE" ? "/team?status=deactivated" : "/team"} variant="ghost" size="sm">
                {status === "ACTIVE" ? t("showDeactivated") : t("showActive")}
              </ButtonLink>
            </>
          }
        />
        {members === null ? (
          <EmptyState title={t("directoryUnavailableTitle")} hint={t("directoryUnavailableHint")} />
        ) : members.length === 0 ? (
          <EmptyState title={status === "ACTIVE" ? t("noneTitle") : t("noDeactivatedTitle")} />
        ) : (
          <ul className="flex flex-col">
            {members.map((m, i) => (
              <li
                key={m.user.id}
                // `animate-rise` gives every row its own stacking context (its keyframes touch
                // opacity/transform), which traps the MemberActions dropdown's z-40 inside that
                // row — a later sibling row otherwise paints over it regardless of that nested
                // z-index. `relative` + a z-index bump while its own <details> is open lets the
                // row (and everything nested inside it) outrank its siblings for real.
                className="animate-rise relative flex items-center gap-4 rounded-[18px] px-3 py-3 hover:bg-surface-elevated has-[details[open]]:z-10"
                style={{ "--i": i } as React.CSSProperties}
              >
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
                {m.status === "ACTIVE" && <MemberRoleSelect workspaceId={ws.id} userId={m.user.id} role={m.role} options={m.assignableRoles} name={m.user.name} />}
                <MemberActions
                  workspaceId={ws.id}
                  userId={m.user.id}
                  name={m.user.name}
                  status={m.status}
                  canRemove={m.canRemove}
                  canDeactivate={m.canDeactivate}
                  canTransferOwnershipTo={m.canTransferOwnershipTo}
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
