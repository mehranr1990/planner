import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Chip, RingGauge, SegmentedBar, toneOf, type Tone } from "@/components/ui/data-viz";
import { PeopleCluster } from "@/components/ui/people-cluster";
import { Metric } from "@/components/ui/surface";
import { useFormat } from "@/i18n/use-format";
import type { ProjectHealth, ProjectSummary } from "../server/queries";

// Enum → tone only. Labels come from messages (projects.status.*, projects.health.*).
export const HEALTH_TONE: Record<ProjectHealth, "green" | "yellow" | "red"> = {
  ON_TRACK: "green",
  AT_RISK: "yellow",
  OFF_TRACK: "red",
};

/** Allocation badge tone: busier members read warmer, like the reference's red/yellow/blue chips. */
function allocationTone(open: number): Tone {
  if (open >= 5) return "red";
  if (open >= 3) return "yellow";
  if (open >= 1) return "blue";
  return "slate";
}

export function ProjectCard({ project, index = 0 }: { project: ProjectSummary; index?: number }) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const f = useFormat();
  const total = project.openTasks + project.doneTasks;
  const fraction = total ? project.doneTasks / total : 0;
  const space = project.context.kind === "workspace" ? project.context.name : tc("personal");
  const anyAllocated = project.members.some((m) => m.openAssigned > 0);
  return (
    <article
      className="animate-rise group relative flex flex-col rounded-[var(--radius-card)] bg-surface-elevated p-5 ring-1 ring-border-subtle transition-shadow hover:ring-border-strong"
      style={{ "--i": index } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] leading-6 font-medium" dir="auto">
            <Link href={`/projects/${project.id}`} className="after:absolute after:inset-0 after:rounded-[var(--radius-card)]">
              {project.name}
            </Link>
          </h3>
          <p className="mt-0.5 truncate text-[12.5px] text-foreground-muted">{t("card.meta", { space, status: t(`status.${project.status}`) })}</p>
        </div>
        <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full ring-1 ring-border-subtle transition-colors group-hover:bg-surface-active group-hover:text-foreground-on-active">
          <ArrowUpRight className="size-4 rtl:-scale-x-100" />
        </span>
      </div>

      {/* People near the top, as in the reference: faces with task-allocation counts. */}
      {project.members.length > 0 && (
        <div className="mt-4">
          <PeopleCluster
            variant={anyAllocated ? "spaced" : "overlap"}
            size="md"
            max={5}
            total={project.memberCount}
            label={t("card.members")}
            people={project.members.map((m) => ({
              ...m,
              badge: anyAllocated ? { kind: "count", value: m.openAssigned, tone: allocationTone(m.openAssigned), label: t("card.allocationBadge", { count: m.openAssigned }) } : undefined,
            }))}
          />
          <p className="mt-1.5 text-[12px] text-foreground-muted">{anyAllocated ? t("card.allocation") : tc("members", { count: project.memberCount })}</p>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-4">
        <Metric value={f.number(project.openTasks)} label={t("card.openTasks")} />
        <Metric value={f.number(project.overdueTasks)} label={t("card.overdue")} />
      </div>

      <div className="mt-5 flex items-center gap-4">
        <RingGauge value={project.doneTasks} max={total} tone={toneOf(project.color)} size={64} ariaLabel={t("card.completionAria", { name: project.name, percent: fraction })}>
          <span className="tabular text-[15px] leading-4">{f.percent(fraction)}</span>
          <span className="text-[10px] text-foreground-muted">{t("card.done")}</span>
        </RingGauge>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <SegmentedBar
            ariaLabel={t("card.tasksAria", { done: project.doneTasks, open: project.openTasks - project.overdueTasks, overdue: project.overdueTasks })}
            segments={[
              { value: project.doneTasks, tone: "blue", key: "done" },
              { value: project.openTasks - project.overdueTasks, tone: "yellow", key: "open" },
              { value: project.overdueTasks, tone: "red", key: "overdue" },
            ]}
          />
          <Chip tone={HEALTH_TONE[project.health]} className="self-start">
            {t(`health.${project.health}`)}
          </Chip>
        </div>
      </div>
    </article>
  );
}
