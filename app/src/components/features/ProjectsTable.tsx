import { useQuery } from "@apollo/client/react";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/primitives/table";
import { ProjectsByUserQuery } from "@/projects/queries";
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
 * in a table, each row linking into the project. Owns the data fetch so the
 * `UserHomeView` only has to drop it in.
 */
export function ProjectsTable({ userId }: { userId: string }) {
  const { data, loading, error } = useQuery(ProjectsByUserQuery, {
    variables: { userId },
  });

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
        Could not load Vamps: {error.message}
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
    <Table data-testid={testIds.ProjectsTable.table}>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Created</TableHead>
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
