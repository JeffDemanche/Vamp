import { useMutation } from "@apollo/client/react";
import { Loader2, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/primitives/button";
import {
  CreateEmptyProjectMutation,
  ProjectsByUserQuery,
} from "@/projects/queries";

/**
 * Toolbar action that creates a new empty project for the given owner (with a
 * server-generated poetic title), refreshes the owner's project list, and
 * navigates into the new project.
 */
export function CreateProjectButton({ ownerId }: { ownerId: string }) {
  const navigate = useNavigate();

  const [createProject, { loading }] = useMutation(CreateEmptyProjectMutation, {
    refetchQueries: [{ query: ProjectsByUserQuery, variables: { userId: ownerId } }],
  });

  async function onCreate() {
    const result = await createProject({ variables: { ownerId } });
    const id = result.data?.createEmptyProject._id;
    if (id) {
      navigate(`/projects/${id}`);
    }
  }

  return (
    <Button onClick={onCreate} disabled={loading}>
      {loading ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : (
        <Plus aria-hidden />
      )}
      New project
    </Button>
  );
}
