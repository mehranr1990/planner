import { Calendar, Maximize2, Share2, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Metric, PageTitle, Panel, SectionHeader } from "@/components/ui/surface";
import { getFormat } from "@/i18n/get-format";
import { cn } from "@/lib/cn";
import { listProjectOptions } from "@/features/projects/server/queries";
import { getMentionCandidates, listTaskComments } from "@/features/collaboration/server/queries";
import { listLabels } from "@/features/labels/server/queries";
import { listMilestoneOptions } from "@/features/milestones/server/queries";
import { getMyReminder } from "@/features/reminders/server/queries";
import { FilterBar } from "@/features/tasks/components/filter-bar";
import { QuickAdd } from "@/features/tasks/components/quick-add";
import { TaskListWithSelection } from "@/features/tasks/components/task-list-with-selection";
import { TaskSheet } from "@/features/tasks/components/task-sheet";
import { UndoDeleteBanner } from "@/features/tasks/components/undo-delete-banner";
import { isPlannerView, PLANNER_VIEWS, type PlannerScopeFilter } from "@/features/tasks/domain/planner-views";
import { creatableContexts, defaultCreateContext, parseScopeFilter } from "@/features/tasks/server/contexts";
import { parsePlannerFilters } from "@/features/tasks/server/filters";
import { getAssignableMembers, getPlannerCounts, getPlannerTasks, getTaskDetail, getTaskLabelOptions } from "@/features/tasks/server/queries";
import { listMembers } from "@/features/workspace/server/queries";
import { getViewer } from "@/server/context";

export async function generateMetadata({ params }: PageProps<"/planner/[view]">): Promise<Metadata> {
  const { view } = await params;
  const t = await getTranslations("planner");
  return { title: isPlannerView(view) ? t(`views.${view}.label`) : t("title") };
}

function scopeParam(filter: PlannerScopeFilter) {
  return filter.kind === "all" ? "" : filter.kind === "personal" ? "personal" : filter.workspaceId;
}

/** Quick-add syntax tokens. These are parser vocabulary (English), not UI copy, so they aren't translated. */
const SYNTAX = [
  ["today", "tomorrow", "fri", "next week"],
  ["9am", "at 14:30"],
  ["!high", "!urgent", "!low"],
] as const;

export default async function PlannerPage({ params, searchParams }: PageProps<"/planner/[view]">) {
  const { view } = await params;
  if (!isPlannerView(view)) notFound();
  const sp = await searchParams;
  const viewer = await getViewer();
  const [t, tc, f] = await Promise.all([getTranslations("planner"), getTranslations("common"), getFormat()]);
  const panelActions: { Icon: LucideIcon; label: string }[] = [
    { Icon: Share2, label: t("panelActions.share") },
    { Icon: Calendar, label: t("panelActions.calendar") },
    { Icon: Maximize2, label: t("panelActions.expand") },
  ];
  const filter = parseScopeFilter(viewer, sp.scope);
  const filters = parsePlannerFilters(sp);
  const taskId = typeof sp.task === "string" ? sp.task : null;
  const deletedId = typeof sp.deleted === "string" ? sp.deleted : null;
  // Label/assignee filter option lists only make sense for a specific scope (labels are literally
  // scoped PERSONAL/WORKSPACE; workspace membership only exists for a workspace) — same rule
  // `task-sheet.tsx` already applies when editing a single task's labels/assignees.
  const filterLabelScope = filter.kind === "workspace" ? ({ scope: "WORKSPACE", workspaceId: filter.workspaceId } as const) : filter.kind === "personal" ? ({ scope: "PERSONAL" } as const) : null;

  const [{ today, tasks, truncated }, counts, detail, projectOptions, filterLabelOptions, filterMembers] = await Promise.all([
    getPlannerTasks(viewer, view, filter, filters),
    getPlannerCounts(viewer, filter),
    taskId ? getTaskDetail(viewer, taskId) : null,
    listProjectOptions(viewer),
    filterLabelScope ? listLabels(viewer, filterLabelScope) : Promise.resolve([]),
    filter.kind === "workspace" ? listMembers(viewer, filter.workspaceId) : Promise.resolve(null),
  ]);
  const [members, labelOptions, comments, mentionCandidates, reminder, milestoneOptions] = await Promise.all([
    getAssignableMembers(viewer, detail),
    getTaskLabelOptions(viewer, detail),
    detail ? listTaskComments(viewer, detail.id) : [],
    detail ? getMentionCandidates(viewer, detail.id) : [],
    detail ? getMyReminder(viewer, detail.id) : null,
    listMilestoneOptions(viewer, detail?.project?.id ?? null),
  ]);

  const scope = scopeParam(filter);
  const withScope = (path: string) => (scope ? `${path}?scope=${scope}` : path);
  const badge: Partial<Record<string, number>> = { inbox: counts.inbox, today: counts.today, overdue: counts.overdue, delegated: counts.delegated };
  const scopes = [
    { value: "", label: t("everything") },
    { value: "personal", label: tc("personal") },
    ...viewer.workspaces.map((w) => ({ value: w.id, label: w.name })),
  ];

  return (
    <>
      <PageTitle>{t("title")}</PageTitle>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Panel aria-labelledby="view-heading">
          {/* Reference panel header: section title at the start, selectable pills centred at the top. */}
          <div className="mb-4 flex flex-col gap-3 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:gap-4">
            <SectionHeader className="mb-0 min-w-0" title={<span id="view-heading">{t(`views.${view}.label`)}</span>} count={tasks.length} />
            <nav aria-label={t("viewsNav")} className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
              <ul className="flex w-max items-center gap-1.5">
                {PLANNER_VIEWS.map((v) => {
                  const active = v === view;
                  const n = badge[v];
                  return (
                    <li key={v}>
                      <Link
                        href={withScope(`/planner/${v}`)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap ring-1 transition-colors",
                          active
                            ? "bg-surface-active text-foreground-on-active ring-surface-active"
                            : "bg-surface-elevated text-foreground-muted ring-border-subtle hover:text-foreground hover:ring-border-strong",
                        )}
                      >
                        {t(`views.${v}.label`)}
                        {n !== undefined && n > 0 && (
                          <span
                            className={cn(
                              "tabular rounded-full px-1.5 text-[11px]",
                              active ? "bg-white/15" : v === "overdue" ? "bg-accent-red-soft text-foreground" : "bg-surface-secondary",
                            )}
                          >
                            {f.number(n)}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            {/* Visual only, matching the reference's panel-header actions — no feature behind these yet,
                so these are inert decoration (aria-hidden), not buttons that look clickable but do nothing. */}
            <div aria-hidden className="hidden items-center justify-end gap-2 lg:flex">
              {panelActions.map(({ Icon, label }) => (
                <span
                  key={label}
                  title={label}
                  className="inline-flex size-10 items-center justify-center rounded-full bg-surface-elevated text-foreground ring-1 ring-border-subtle"
                >
                  <Icon className="size-[18px]" strokeWidth={1.75} />
                </span>
              ))}
            </div>
          </div>
          <p className="mb-4 text-[12.5px] text-foreground-muted">{t(`views.${view}.description`)}</p>
          {viewer.workspaces.length > 0 && (
            <div className="scrollbar-none -mx-1 mb-4 flex gap-1 overflow-x-auto px-1" role="group" aria-label={t("filterBySpace")}>
              {scopes.map((s) => (
                <Link
                  key={s.value || "all"}
                  href={s.value ? `/planner/${view}?scope=${s.value}` : `/planner/${view}`}
                  aria-current={s.value === scope ? "true" : undefined}
                  dir="auto"
                  className={cn(
                    "h-8 shrink-0 rounded-full px-3 text-[12.5px] leading-8 ring-1 transition-colors",
                    s.value === scope ? "bg-surface-elevated ring-border-strong" : "text-foreground-muted ring-transparent hover:ring-border-subtle",
                  )}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          )}
          {view !== "completed" && (
            <div className="mb-3">
              <QuickAdd
                today={today}
                contexts={creatableContexts(viewer, tc("personal"))}
                defaultContext={filter.kind === "workspace" ? filter.workspaceId : filter.kind === "personal" ? "personal" : defaultCreateContext(viewer)}
                view={view}
              />
            </div>
          )}
          <FilterBar memberOptions={(filterMembers ?? []).map((m) => ({ id: m.user.id, name: m.user.name }))} labelOptions={filterLabelOptions} projectOptions={projectOptions} />
          <TaskListWithSelection
            view={view}
            tasks={tasks}
            today={today}
            timezone={viewer.user.timezone}
            showContext={filter.kind === "all" && viewer.workspaces.length > 0}
            empty={{ title: t(`views.${view}.emptyTitle`), hint: t(`views.${view}.emptyHint`) }}
            orderable={view === "inbox" || view === "someday" || view === "all"}
            labelOptions={filterLabelOptions}
            memberOptions={(filterMembers ?? []).map((m) => ({ id: m.user.id, name: m.user.name }))}
            projectOptions={projectOptions}
          />
          {truncated && <p className="mt-4 px-3 text-[12.5px] text-foreground-muted">{t("truncated", { limit: 200 })}</p>}
        </Panel>

        <aside aria-label={t("summary.label")} className="hidden flex-col gap-4 xl:flex">
          <Panel>
            <p className="text-[12.5px] text-foreground-muted" data-volatile>
              {f.date(today, { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-5">
              <Metric value={f.number(counts.today)} label={t("summary.dueToday")} />
              <Metric value={f.number(counts.overdue)} label={t("summary.overdue")} />
              <Metric value={f.number(counts.inbox)} label={t("summary.inInbox")} />
            </div>
          </Panel>
          <Panel className="text-[12.5px] leading-6 text-foreground-muted">
            <p className="mb-2 font-medium text-foreground">{t("help.title")}</p>
            <ul className="flex flex-col gap-1">
              {SYNTAX.map((group, i) => (
                <li key={i} className="flex flex-wrap gap-x-2" dir="ltr">
                  {group.map((token) => (
                    <code key={token} className="text-foreground">
                      {token}
                    </code>
                  ))}
                </li>
              ))}
              <li>
                <code className="text-foreground" dir="ltr">
                  someday
                </code>{" "}
                — {t("help.someday")}
              </li>
              <li>{t.rich("help.quotes", { code: (chunks) => <code className="text-foreground">{chunks}</code> })}</li>
            </ul>
            <p className="mt-3 text-[12px] text-foreground-subtle">{t("help.language")}</p>
          </Panel>
        </aside>
      </div>

      {detail && (
        <TaskSheet
          key={detail.id}
          task={detail}
          projects={projectOptions}
          members={members}
          labelOptions={labelOptions}
          milestoneOptions={milestoneOptions}
          comments={comments}
          mentionCandidates={mentionCandidates}
          currentUser={{ id: viewer.user.id, name: viewer.user.name, avatarUrl: viewer.user.avatarUrl }}
          reminder={reminder}
          today={today}
          timezone={viewer.user.timezone}
        />
      )}
      {deletedId && <UndoDeleteBanner taskId={deletedId} />}
    </>
  );
}
