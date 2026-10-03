"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setProjectArchivedAction, updateProjectStatusAction } from "../server/actions";
import type { ProjectHealth, ProjectStatus } from "../server/queries";

const STATUSES: ProjectStatus[] = ["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"];
const HEALTHS: ProjectHealth[] = ["ON_TRACK", "AT_RISK", "OFF_TRACK"];

const pill = "h-10 rounded-full bg-surface-elevated px-4 text-[13px] ring-1 ring-border-subtle focus:outline-none disabled:opacity-50";

export function ProjectControls({ projectId, status, health, archived }: { projectId: string; status: ProjectStatus; health: ProjectHealth; archived: boolean }) {
  const t = useTranslations("projects");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? null);
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="project-status" className="sr-only">
        {t("detail.statusLabel")}
      </label>
      <select id="project-status" className={pill} defaultValue={status} disabled={pending || archived} onChange={(e) => run(() => updateProjectStatusAction({ projectId, status: e.target.value as ProjectStatus }))}>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(`status.${s}`)}
          </option>
        ))}
      </select>
      <label htmlFor="project-health" className="sr-only">
        {t("detail.healthLabel")}
      </label>
      <select id="project-health" className={pill} defaultValue={health} disabled={pending || archived} onChange={(e) => run(() => updateProjectStatusAction({ projectId, health: e.target.value as ProjectHealth }))}>
        {HEALTHS.map((h) => (
          <option key={h} value={h}>
            {t(`health.${h}`)}
          </option>
        ))}
      </select>
      <Button variant="secondary" disabled={pending} onClick={() => run(() => setProjectArchivedAction({ projectId, archived: !archived }))}>
        {archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
        {archived ? t("detail.restore") : t("detail.archive")}
      </Button>
      {error && (
        <p role="alert" className="w-full text-[12.5px] text-accent-red">
          {error}
        </p>
      )}
    </div>
  );
}
