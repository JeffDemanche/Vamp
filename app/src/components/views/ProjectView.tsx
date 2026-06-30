import { useQuery } from "@apollo/client/react";
import { Loader2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { ClipHotkeys } from "@/components/features/ClipHotkeys";
import { ProjectTitleField } from "@/components/features/ProjectTitleField";
import { EditorProvider } from "@/components/features/EditorProvider";
import { TimelineEditor } from "@/components/features/TimelineEditor";
import { TrackPane } from "@/components/features/TrackPane";
import { HotkeyProvider } from "@/hotkeys/HotkeyProvider";
import { ProjectQuery } from "@/projects/queries";
import { testIds } from "@/testIds";

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data, loading, error } = useQuery(ProjectQuery, {
    variables: { id: projectId ?? "" },
    skip: !projectId,
  });

  if (loading) {
    return (
      <div
        data-testid={testIds.ProjectView.root}
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
        data-testid={testIds.ProjectView.root}
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
      data-testid={testIds.ProjectView.root}
      className="flex h-screen flex-col bg-background px-6 py-8 text-foreground"
    >
      <header className="shrink-0">
        <ProjectTitleField projectId={project._id} title={project.title} />
        <p className="mt-1 px-1 text-sm text-muted-foreground">
          Owned by {project.owner.user.username}
        </p>
      </header>

      <HotkeyProvider>
        <EditorProvider projectId={project._id} initialState={data?.projectUser}>
          <ClipHotkeys projectId={project._id} />
          <div className="mt-6 flex min-h-0 flex-1 gap-3">
            <TrackPane projectId={project._id} />
            <div className="min-w-0 flex-1">
              <TimelineEditor projectId={project._id} />
            </div>
          </div>
        </EditorProvider>
      </HotkeyProvider>
    </div>
  );
}
