import type { Reference } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { Archive, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { Button } from "@/components/primitives/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/primitives/table";
import { logError } from "@/lib/errors";
import {
  ProjectsByUserQuery,
  SetProjectArchivedMutation,
} from "@/projects/queries";
import { testIds } from "@/testIds";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

/**
 * Lists the projects a user owns or collaborates on (excluding archived ones)
 * in a table, each row linking into the project and offering an archive action.
 * Owns the data fetch so the `UserHomeView` only has to drop it in.
 */
export function ProjectsTable({ userId }: { userId: string }) {
  const { data, loading, error } = useQuery(ProjectsByUserQuery, {
    variables: { userId },
  });

  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [archiveFailed, setArchiveFailed] = useState(false);
  // The project awaiting archive confirmation (drives the confirm dialog).
  const [pendingArchive, setPendingArchive] = useState<{
    _id: string;
    title: string;
  } | null>(null);
  // The title shown in the dialog. Kept separate from `pendingArchive` so the
  // body text survives the dialog's fade-out animation (clearing
  // `pendingArchive` closes the dialog, but the content stays mounted while it
  // animates out).
  const [archiveTitle, setArchiveTitle] = useState("");

  const [setProjectArchived] = useMutation(SetProjectArchivedMutation, {
    // Drop the now-archived project from the cached active list so the row
    // disappears without a refetch (the list excludes archived projects).
    // `cache.modify` filters the field's references in place across every
    // `projectsByUser(...)` variant, avoiding the "cache data may be lost"
    // warning that overwriting the whole array via `updateQuery` triggers.
    update(cache, { data: result }) {
      const archivedId = result?.setProjectArchived._id;
      if (!archivedId) return;
      cache.modify({
        fields: {
          projectsByUser(existing: readonly Reference[] = [], { readField }) {
            return existing.filter(
              (ref) => readField("_id", ref) !== archivedId,
            );
          },
        },
      });
    },
  });

  useEffect(() => {
    if (error) logError("Failed to load projects for the home view", error);
  }, [error]);

  async function confirmArchive() {
    if (!pendingArchive) return;
    const { _id } = pendingArchive;
    setArchivingId(_id);
    setArchiveFailed(false);
    try {
      await setProjectArchived({ variables: { id: _id, archived: true } });
    } catch (err) {
      logError(`Failed to archive project ${_id}`, err);
      setArchiveFailed(true);
    } finally {
      setArchivingId(null);
      setPendingArchive(null);
    }
  }

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading Vamps"
        className="flex items-center gap-2 py-6 text-muted-foreground"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading Vamps…
      </div>
    );
  }

  if (error) {
    return (
      <p data-testid={testIds.ProjectsTable.error} className="py-6 text-destructive">
        Something went wrong loading your Vamps.
      </p>
    );
  }

  const projects = data?.projectsByUser ?? [];

  if (projects.length === 0) {
    return (
      <p data-testid={testIds.ProjectsTable.empty} className="py-6 text-muted-foreground">
        You don&apos;t have any Vamps yet. Create one to get started.
      </p>
    );
  }

  return (
    <>
      <Table data-testid={testIds.ProjectsTable.table}>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-0">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow key={project._id}>
              <TableCell className="font-medium">
                <Link
                  to={`/projects/${project._id}`}
                  className="hover:underline"
                >
                  {project.title}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatCreatedAt(project.createdAt)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Archive ${project.title}`}
                  title="Archive"
                  data-testid={testIds.ProjectsTable.archive}
                  disabled={archivingId === project._id}
                  onClick={() => {
                    setPendingArchive({
                      _id: project._id,
                      title: project.title,
                    });
                    setArchiveTitle(project.title);
                  }}
                >
                  {archivingId === project._id ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Archive aria-hidden />
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {archiveFailed && (
        <p role="alert" className="px-3 py-2 text-sm text-destructive">
          Something went wrong archiving that Vamp.
        </p>
      )}
      <ConfirmDialog
        open={pendingArchive !== null}
        onOpenChange={(open) => {
          if (!open && archivingId === null) setPendingArchive(null);
        }}
        title="Archive this Vamp?"
        description={`"${archiveTitle}" will be removed from your Vamps.`}
        confirmLabel="Archive"
        destructive
        pending={archivingId !== null}
        onConfirm={confirmArchive}
        confirmTestId={testIds.ProjectsTable.archiveConfirm}
        cancelTestId={testIds.ProjectsTable.archiveCancel}
      />
    </>
  );
}
