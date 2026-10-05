import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Panel } from "@/components/ui/surface";
import { ProjectHeader } from "@/features/projects/components/project-tabs";
import { MilestoneList } from "@/features/projects/components/milestones/milestone-list";
import { getProject } from "@/features/projects/server/queries";
import { getMilestones } from "@/features/milestones/server/queries";
import { getViewer } from "@/server/context";

export async function generateMetadata({ params }: PageProps<"/projects/[projectId]/milestones">): Promise<Metadata> {
  const { projectId } = await params;
  const viewer = await getViewer();
  const project = await getProject(viewer, projectId);
  const [t, tt] = await Promise.all([getTranslations("projects"), getTranslations("projects.tabs")]);
  return { title: project ? `${project.name} · ${tt("milestones")}` : t("title") };
}

export default async function MilestonesPage({ params }: PageProps<"/projects/[projectId]/milestones">) {
  const { projectId } = await params;
  const viewer = await getViewer();
  const project = await getProject(viewer, projectId);
  if (!project) notFound();
  const [milestones, t] = await Promise.all([getMilestones(viewer, project.id), getTranslations("milestones")]);
  if (!milestones) notFound();

  return (
    <>
      <ProjectHeader project={project} active="milestones" />
      <Panel aria-labelledby="milestones-heading">
        <h2 id="milestones-heading" className="sr-only">
          {t("heading")}
        </h2>
        <MilestoneList projectId={project.id} milestones={milestones} />
      </Panel>
    </>
  );
}
