import { graphql } from "../generated";

/**
 * The projects a user owns or collaborates on, excluding archived ones. Used
 * by `UserHomeView` to populate the projects table.
 */
export const ProjectsByUserQuery = graphql(`
  query ProjectsByUser($userId: ID!) {
    projectsByUser(userId: $userId) {
      _id
      title
      archived
      createdAt
    }
  }
`);

/** Creates a new empty project with an auto-generated poetic title. */
export const CreateEmptyProjectMutation = graphql(`
  mutation CreateEmptyProject($ownerId: ID!) {
    createEmptyProject(ownerId: $ownerId) {
      _id
      title
      archived
      createdAt
    }
  }
`);

/**
 * A single project with the metadata the `ProjectView` header needs (title and
 * owner) plus the project's tracks for the editor's track pane. Used to populate
 * the project editor screen.
 */
export const ProjectQuery = graphql(`
  query Project($id: ID!) {
    project(id: $id) {
      _id
      title
      owner {
        _id
        username
      }
      projectData {
        _id
        tracks {
          _id
          name
        }
      }
    }
  }
`);

/** Updates metadata stored directly on a project, currently its title. */
export const UpdateProjectMetadataMutation = graphql(`
  mutation UpdateProjectMetadata($input: UpdateProjectMetadataInput!) {
    updateProjectMetadata(input: $input) {
      _id
      title
    }
  }
`);
