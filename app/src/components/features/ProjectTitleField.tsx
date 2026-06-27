import { useMutation } from "@apollo/client/react";
import { EditableHeading } from "@/components/primitives/editable-heading";
import type { UpdateProjectMetadataMutation as UpdateProjectMetadataResult } from "@/generated/graphql";
import { UpdateProjectMetadataMutation } from "@/projects/queries";

/**
 * The editable project title in the `ProjectView` header. Renders the title as
 * an `EditableHeading` and persists edits through `updateProjectMetadata`,
 * optimistically updating the cache so the new title shows immediately.
 */
export function ProjectTitleField({
  projectId,
  title,
}: {
  projectId: string;
  title: string;
}) {
  const [updateTitle] = useMutation(UpdateProjectMetadataMutation);

  function onCommit(nextTitle: string) {
    void updateTitle({
      variables: { input: { id: projectId, title: nextTitle } },
      // `__typename` is required so Apollo can normalize the optimistic write
      // onto the cached `Project`; codegen omits it from the result type.
      optimisticResponse: {
        updateProjectMetadata: {
          __typename: "Project",
          _id: projectId,
          title: nextTitle,
        },
      } as UpdateProjectMetadataResult,
    });
  }

  return <EditableHeading value={title} onCommit={onCommit} editLabel="Edit Vamp name" />;
}
