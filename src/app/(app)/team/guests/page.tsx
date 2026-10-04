import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/data-viz";
import { EmptyState, PageTitle, Panel, SectionHeader } from "@/components/ui/surface";
import { MemberActions } from "@/features/workspace/components/member-actions";
import { NoActiveWorkspace } from "@/features/workspace/components/no-active-workspace";
import { TeamNav } from "@/features/workspace/components/team-nav";
import { listGuests } from "@/features/workspace/server/queries";
import { getViewer } from "@/server/context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("workspace");
  return { title: t("guestsTitle") };
}

export default async function GuestsPage() {
  const viewer = await getViewer();
  const t = await getTranslations("workspace");
  const ws = viewer.activeWorkspace;

  if (!ws) {
    return (
      <>
        <PageTitle>{t("guestsTitle")}</PageTitle>
        <NoActiveWorkspace viewer={viewer} />
      </>
    );
  }

  const guests = await listGuests(viewer, ws.id);
  return (
    <>
      <PageTitle>{t("guestsTitle")}</PageTitle>
      <TeamNav />
      <Panel aria-labelledby="guests-heading">
        <SectionHeader title={<span id="guests-heading">{t("guestsTitle")}</span>} count={guests?.length} />
        {guests === null ? (
          <EmptyState title={t("directoryUnavailableTitle")} hint={t("directoryUnavailableHint")} />
        ) : guests.length === 0 ? (
          <EmptyState title={t("noGuestsTitle")} hint={t("noGuestsHint")} />
        ) : (
          <ul className="flex flex-col">
            {guests.map((g, i) => (
              <li key={g.user.id} className="animate-rise flex items-center gap-4 rounded-[18px] px-3 py-3 hover:bg-surface-elevated" style={{ "--i": i } as React.CSSProperties}>
                <Avatar person={g.user} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-medium" dir="auto">
                    {g.user.name}
                  </p>
                </div>
                {g.isExternal && <Chip tone="peach">{t("external")}</Chip>}
                <MemberActions workspaceId={ws.id} userId={g.user.id} name={g.user.name} status="ACTIVE" canRemove={g.canRemove} canDeactivate={false} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
