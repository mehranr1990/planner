import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState, PageTitle, Panel, SectionHeader } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { CreateProjectButton } from "@/features/projects/components/create-project";
import { ProjectCard } from "@/features/projects/components/project-card";
import { listProjects } from "@/features/projects/server/queries";
import { can } from "@/server/permissions/capabilities";
import { getViewer } from "@/server/context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projects");
  return { title: t("title") };
}

export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  const viewer = await getViewer();
  const [t, tc] = await Promise.all([getTranslations("projects"), getTranslations("common")]);
  const { archived } = await searchParams;
  const showArchived = archived === "1";
  // Projects follow the active context: personal, or the active workspace.
  const workspaceId = viewer.activeWorkspace?.id ?? null;
  const all = await listProjects(viewer, { workspaceId, includeArchived: showArchived });
  const contexts = [
    { value: "personal", label: tc("personal") },
    ...viewer.workspaces.filter((w) => can(w.actor, "projects.create")).map((w) => ({ value: w.id, label: w.name })),
  ];
  const defaultContext = workspaceId && contexts.some((c) => c.value === workspaceId) ? workspaceId : "personal";
  const active = all.filter((p) => p.status === "ACTIVE" || p.status === "PLANNED");
  const other = all.filter((p) => !active.includes(p));

  return (
    <>
      <PageTitle actions={<CreateProjectButton contexts={contexts} defaultContext={defaultContext} />}>{t("title")}</PageTitle>
      <Panel>
        <SectionHeader
          title={viewer.activeWorkspace ? t("sectionWorkspace", { workspace: viewer.activeWorkspace.name }) : t("sectionPersonal")}
          count={active.length}
          actions={
            <Link
              href={showArchived ? "/projects" : "/projects?archived=1"}
              className={cn("h-8 rounded-full px-3 text-[12.5px] leading-8 whitespace-nowrap ring-1 ring-border-subtle", showArchived && "bg-surface-elevated")}
            >
              {showArchived ? t("hideArchived") : t("showArchived")}
            </Link>
          }
        />
        {all.length === 0 ? (
          <EmptyState title={t("emptyTitle")} hint={t("emptyHint")} action={<CreateProjectButton contexts={contexts} defaultContext={defaultContext} />} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {active.map((p, i) => (
                <ProjectCard key={p.id} project={p} index={i} />
              ))}
            </div>
            {other.length > 0 && (
              <>
                <h3 className="mt-8 mb-3 px-1 text-[12.5px] font-medium text-foreground-muted">{t("otherSection")}</h3>
                <div className="grid gap-4 opacity-80 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {other.map((p, i) => (
                    <ProjectCard key={p.id} project={p} index={i} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </Panel>
    </>
  );
}
