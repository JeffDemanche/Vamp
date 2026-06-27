import { useQuery } from "@apollo/client/react";
import { Loader2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { ProjectTitleField } from "@/components/features/ProjectTitleField";
import { TimelineEditor } from "@/components/features/TimelineEditor";
import { ProjectQuery } from "@/projects/queries";

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data, loading, error } = useQuery(ProjectQuery, {
    variables: { id: projectId ?? "" },
    skip: !projectId,
  });

  if (loading) {
    return (
      <div
        data-testid="project-view"
        className="flex min-h-screen items-center justify-center bg-background text-muted-foreground"
      >
        <div role="status" aria-label="Loading Vamp" className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading Vamp…
        </div>
      </div>
    );
  }

  const project = data?.project;

  if (error || !project) {
    return (
      <div
        data-testid="project-view"
        className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vamp not found</h1>
          <p className="mt-1 text-muted-foreground">
            {error
              ? `Could not load this Vamp: ${error.message}`
              : "This Vamp doesn't exist or you don't have access to it."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="project-view"
      className="flex h-screen flex-col bg-background px-6 py-8 text-foreground"
    >
      <header className="shrink-0">
        <ProjectTitleField projectId={project._id} title={project.title} />
        <p className="mt-1 px-1 text-sm text-muted-foreground">
          Owned by {project.owner.username}
        </p>
      </header>

      <div className="mt-6 min-h-0 flex-1">
        <TimelineEditor />
      </div>
    </div>
  );
}
