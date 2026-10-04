import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Panel } from "@/components/ui/surface";
import type { Viewer } from "@/server/context";

/** Shared empty state for any workspace-scoped page when there's no active workspace. */
export async function NoActiveWorkspace({ viewer }: { viewer: Viewer }) {
  const t = await getTranslations("workspace");
  const hasWorkspaces = viewer.workspaces.length > 0;
  return (
    <Panel>
      <EmptyState
        title={hasWorkspaces ? t("personalTitle") : t("noneTitle")}
        hint={hasWorkspaces ? t("personalHint") : t("noneHint")}
        action={
          <ButtonLink href="/settings/account#workspaces" variant="primary">
            {hasWorkspaces ? t("personalAction") : t("noneAction")}
          </ButtonLink>
        }
      />
    </Panel>
  );
}
