import { ProjectModel } from "../src/entities/Project";
import { ProjectDataModel } from "../src/entities/ProjectData";
import { ProjectUserModel } from "../src/entities/ProjectUser";
import { UserModel } from "../src/entities/User";
import { execute, startTestStack, stopTestStack, type TestStack } from "./testServer";

const REGISTER = /* GraphQL */ `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      _id
    }
  }
`;

const CREATE_PROJECT = /* GraphQL */ `
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      _id
      title
      owner {
        _id
        user {
          _id
          username
        }
      }
      contributors {
        _id
        user {
          _id
          username
        }
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
`;

const GET_PROJECT = /* GraphQL */ `
  query Project($id: ID!) {
    project(id: $id) {
      _id
      title
      owner {
        user {
          username
        }
      }
      contributors {
        user {
          username
        }
      }
      projectData {
        _id
      }
    }
  }
`;

const PROJECTS_BY_USER = /* GraphQL */ `
  query ProjectsByUser($userId: ID!) {
    projectsByUser(userId: $userId) {
      _id
      title
    }
  }
`;

const CREATE_EMPTY_PROJECT = /* GraphQL */ `
  mutation CreateEmptyProject($ownerId: ID!) {
    createEmptyProject(ownerId: $ownerId) {
      _id
      title
      archived
      owner {
        _id
        user {
          _id
        }
      }
      contributors {
        _id
      }
      projectData {
        _id
      }
    }
  }
`;

const SET_PROJECT_ARCHIVED = /* GraphQL */ `
  mutation SetProjectArchived($id: ID!, $archived: Boolean!) {
    setProjectArchived(id: $id, archived: $archived) {
      _id
      archived
    }
  }
`;

const UPDATE_PROJECT_METADATA = /* GraphQL */ `
  mutation UpdateProjectMetadata($input: UpdateProjectMetadataInput!) {
    updateProjectMetadata(input: $input) {
      _id
      title
    }
  }
`;

let stack: TestStack;

beforeAll(async () => {
  stack = await startTestStack();
});

afterAll(async () => {
  await stopTestStack(stack);
});

afterEach(async () => {
  await Promise.all([
    ProjectModel.deleteMany({}),
    ProjectDataModel.deleteMany({}),
    ProjectUserModel.deleteMany({}),
    UserModel.deleteMany({}),
  ]);
});

async function createUser(username: string, email: string): Promise<string> {
  const res = await execute<{ register: { _id: string } }>(stack.apollo, REGISTER, {
    input: { username, email, password: "a-good-password" },
  });
  return res.data!.register._id;
}

describe("Project API (field resolution + layered services)", () => {
  it("creates a project, auto-provisions ProjectData, and resolves relations", async () => {
    const ownerId = await createUser("owner", "owner@example.com");
    const contributorId = await createUser("contrib", "contrib@example.com");

    const created = await execute<{
      createProject: {
        _id: string;
        title: string;
        owner: { _id: string; user: { _id: string; username: string } };
        contributors: { _id: string; user: { _id: string; username: string } }[];
        projectData: { _id: string; tracks: { _id: string; name: string }[] };
      };
    }>(stack.apollo, CREATE_PROJECT, {
      input: { title: "First Song", ownerId, contributorIds: [contributorId] },
    });

    expect(created.errors).toBeUndefined();
    const project = created.data!.createProject;
    expect(project.title).toBe("First Song");
    // `owner`/`contributors` are now ProjectUser memberships; the User is nested.
    expect(project.owner.user).toMatchObject({ _id: ownerId, username: "owner" });
    expect(project.contributors).toHaveLength(1);
    expect(project.contributors[0]?.user).toMatchObject({
      _id: contributorId,
      username: "contrib",
    });
    expect(project.projectData._id).toBeTruthy();

    // ProjectData was created as a side effect of creating the project.
    await expect(ProjectDataModel.countDocuments()).resolves.toBe(1);

    // It is seeded with a single starter track owned by the project's creator.
    expect(project.projectData.tracks).toHaveLength(1);
    const data = await ProjectDataModel.findById(project.projectData._id).lean();
    expect(data?.tracks).toHaveLength(1);
    expect(String(data?.tracks[0]?.creator)).toBe(ownerId);

    const fetched = await execute<{
      project: { title: string; owner: { user: { username: string } } } | null;
    }>(stack.apollo, GET_PROJECT, { id: project._id });
    expect(fetched.data?.project?.title).toBe("First Song");
    expect(fetched.data?.project?.owner.user.username).toBe("owner");
  });

  it("returns projects a user owns or contributes to", async () => {
    const ownerId = await createUser("owner", "owner@example.com");
    const contributorId = await createUser("contrib", "contrib@example.com");

    await execute(stack.apollo, CREATE_PROJECT, {
      input: { title: "Owned", ownerId, contributorIds: [] },
    });
    await execute(stack.apollo, CREATE_PROJECT, {
      input: { title: "Contributing", ownerId: contributorId, contributorIds: [ownerId] },
    });

    const owned = await execute<{ projectsByUser: { title: string }[] }>(
      stack.apollo,
      PROJECTS_BY_USER,
      { userId: ownerId },
    );
    expect(owned.errors).toBeUndefined();
    expect(owned.data?.projectsByUser.map((p) => p.title).sort()).toEqual([
      "Contributing",
      "Owned",
    ]);

    const contributing = await execute<{ projectsByUser: { title: string }[] }>(
      stack.apollo,
      PROJECTS_BY_USER,
      { userId: contributorId },
    );
    expect(contributing.data?.projectsByUser.map((p) => p.title)).toEqual(["Contributing"]);
  });

  it("creates an empty project with an auto-generated poetic title and no contributors", async () => {
    const ownerId = await createUser("owner", "owner@example.com");

    const created = await execute<{
      createEmptyProject: {
        _id: string;
        title: string;
        archived: boolean;
        owner: { _id: string; user: { _id: string } };
        contributors: { _id: string }[];
        projectData: { _id: string };
      };
    }>(stack.apollo, CREATE_EMPTY_PROJECT, { ownerId });

    expect(created.errors).toBeUndefined();
    const project = created.data!.createEmptyProject;
    // Title is two non-empty words (an adjective + noun phrase).
    expect(project.title.trim().split(/\s+/)).toHaveLength(2);
    expect(project.archived).toBe(false);
    expect(project.owner.user._id).toBe(ownerId);
    expect(project.contributors).toEqual([]);
    expect(project.projectData._id).toBeTruthy();
    await expect(ProjectDataModel.countDocuments()).resolves.toBe(1);
  });

  it("archives and unarchives a project", async () => {
    const ownerId = await createUser("owner", "owner@example.com");
    const created = await execute<{ createEmptyProject: { _id: string } }>(
      stack.apollo,
      CREATE_EMPTY_PROJECT,
      { ownerId },
    );
    const id = created.data!.createEmptyProject._id;

    const archived = await execute<{ setProjectArchived: { archived: boolean } }>(
      stack.apollo,
      SET_PROJECT_ARCHIVED,
      { id, archived: true },
    );
    expect(archived.errors).toBeUndefined();
    expect(archived.data?.setProjectArchived.archived).toBe(true);

    const unarchived = await execute<{ setProjectArchived: { archived: boolean } }>(
      stack.apollo,
      SET_PROJECT_ARCHIVED,
      { id, archived: false },
    );
    expect(unarchived.data?.setProjectArchived.archived).toBe(false);
  });

  it("updates project metadata (title)", async () => {
    const ownerId = await createUser("owner", "owner@example.com");
    const created = await execute<{ createEmptyProject: { _id: string } }>(
      stack.apollo,
      CREATE_EMPTY_PROJECT,
      { ownerId },
    );
    const id = created.data!.createEmptyProject._id;

    const updated = await execute<{ updateProjectMetadata: { title: string } }>(
      stack.apollo,
      UPDATE_PROJECT_METADATA,
      { input: { id, title: "Renamed Song" } },
    );
    expect(updated.errors).toBeUndefined();
    expect(updated.data?.updateProjectMetadata.title).toBe("Renamed Song");
  });
});
