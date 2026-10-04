"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { archiveTeamAction } from "../server/actions";

export function ArchiveTeamButton({ teamId }: { teamId: string }) {
  const t = useTranslations("workspace.teams");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        {t("archive")}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("archiveTitle")}
        reason={t("archiveReason")}
        confirmLabel={t("archive")}
        onConfirm={async () => {
          await archiveTeamAction({ teamId });
          router.push("/team/teams");
          router.refresh();
        }}
      />
    </>
  );
}
