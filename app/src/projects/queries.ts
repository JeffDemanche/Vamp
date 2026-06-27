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
