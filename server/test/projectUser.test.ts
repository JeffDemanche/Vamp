import { ProjectModel } from "../src/entities/Project";
import { ProjectDataModel } from "../src/entities/ProjectData";
import { ProjectUserModel } from "../src/entities/ProjectUser";
import { UserModel } from "../src/entities/User";
import type { User } from "../src/entities/User";
import { execute, startTestStack, stopTestStack, type TestStack } from "./testServer";

const REGISTER = /* GraphQL */ `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      _id
    }
  }
`;

const CREATE_EMPTY_PROJECT = /* GraphQL */ `
  mutation CreateEmptyProject($ownerId: ID!) {
    createEmptyProject(ownerId: $ownerId) {
      _id
    }
  }
`;

const PROJECT_USER = /* GraphQL */ `
  query ProjectUser($projectId: ID!) {
    projectUser(projectId: $projectId) {
      _id
      playStart
      playEnd
      loop
      viewportStart
      viewportEnd
    }
  }
`;

const UPDATE_PROJECT_USER_STATE = /* GraphQL */ `
  mutation UpdateProjectUserState($input: UpdateProjectUserStateInput!) {
    updateProjectUserState(input: $input) {
      _id
      playStart
      playEnd
      loop
      viewportStart
      viewportEnd
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

/** A minimal `currentUser` context override carrying just the id resolvers need. */
function asUser(id: string): Partial<{ currentUser: User }> {
  return { currentUser: { _id: id } as User };
}

async function createUser(username: string, email: string): Promise<string> {
  const res = await execute<{ register: { _id: string } }>(stack.apollo, REGISTER, {
    input: { username, email, password: "a-good-password" },
  });
  return res.data!.register._id;
}

async function createProject(ownerId: string): Promise<string> {
  const res = await execute<{ createEmptyProject: { _id: string } }>(
    stack.apollo,
    CREATE_EMPTY_PROJECT,
    { ownerId },
  );
  return res.data!.createEmptyProject._id;
}

describe("ProjectUser API (per-user project state)", () => {
  it("returns the owner's default membership state created with the project", async () => {
    const userId = await createUser("user-one", "u@example.com");
    const projectId = await createProject(userId);

    // Creating the project provisions the owner's ProjectUser membership, so it
    // reads back with default view state (not null) even before any edits.
    const res = await execute<{
      projectUser: {
        playStart: number;
        playEnd: number;
        loop: boolean;
        viewportStart: number;
        viewportEnd: number;
      } | null;
    }>(stack.apollo, PROJECT_USER, { projectId }, asUser(userId));
    expect(res.errors).toBeUndefined();
    expect(res.data?.projectUser).toMatchObject({
      playStart: 0,
      playEnd: 441_000,
      loop: false,
      viewportStart: -44_100,
      viewportEnd: 441_000,
    });
  });

  it("upserts and reads back the editor view state for the current user", async () => {
    const userId = await createUser("user-one", "u@example.com");
    const projectId = await createProject(userId);

    const saved = await execute<{ updateProjectUserState: { _id: string } }>(
      stack.apollo,
      UPDATE_PROJECT_USER_STATE,
      {
        input: {
          projectId,
          playStart: 44_100,
          playEnd: 88_200,
          loop: true,
          viewportStart: -1_000,
          viewportEnd: 200_000,
        },
      },
      asUser(userId),
    );
    expect(saved.errors).toBeUndefined();
    expect(saved.data?.updateProjectUserState).toMatchObject({
      playStart: 44_100,
      playEnd: 88_200,
      loop: true,
      viewportStart: -1_000,
      viewportEnd: 200_000,
    });

    // A second save for the same (project, user) updates in place, not inserts.
    const updated = await execute<{ updateProjectUserState: { _id: string } }>(
      stack.apollo,
      UPDATE_PROJECT_USER_STATE,
      { input: { projectId, playStart: 1_000, loop: false } },
      asUser(userId),
    );
    expect(updated.data?.updateProjectUserState._id).toBe(
      saved.data?.updateProjectUserState._id,
    );
    // Only the provided fields change; the rest are left untouched.
    expect(updated.data?.updateProjectUserState).toMatchObject({
      playStart: 1_000,
      playEnd: 88_200,
      loop: false,
      viewportStart: -1_000,
      viewportEnd: 200_000,
    });
    await expect(ProjectUserModel.countDocuments()).resolves.toBe(1);

    const fetched = await execute<{
      projectUser: { playStart: number; playEnd: number; loop: boolean };
    }>(stack.apollo, PROJECT_USER, { projectId }, asUser(userId));
    expect(fetched.data?.projectUser).toMatchObject({
      playStart: 1_000,
      playEnd: 88_200,
      loop: false,
    });
  });

  it("leaves omitted fields at their defaults when updating a subset", async () => {
    const userId = await createUser("user-one", "u@example.com");
    const projectId = await createProject(userId);

    const saved = await execute<{
      updateProjectUserState: {
        playStart: number;
        playEnd: number;
        loop: boolean;
        viewportStart: number;
        viewportEnd: number;
      };
    }>(
      stack.apollo,
      UPDATE_PROJECT_USER_STATE,
      { input: { projectId, viewportStart: -5_000, viewportEnd: 500_000 } },
      asUser(userId),
    );
    expect(saved.data?.updateProjectUserState).toMatchObject({
      viewportStart: -5_000,
      viewportEnd: 500_000,
      playStart: 0,
      playEnd: 441_000,
      loop: false,
    });
  });

  it("scopes state per user — another user sees their own (absent) state", async () => {
    const userA = await createUser("user-a", "a@example.com");
    const userB = await createUser("user-b", "b@example.com");
    const projectId = await createProject(userA);

    await execute(
      stack.apollo,
      UPDATE_PROJECT_USER_STATE,
      { input: { projectId, playStart: 5_000 } },
      asUser(userA),
    );

    const forB = await execute<{ projectUser: unknown | null }>(
      stack.apollo,
      PROJECT_USER,
      { projectId },
      asUser(userB),
    );
    expect(forB.data?.projectUser).toBeNull();
  });

  it("requires authentication", async () => {
    const userId = await createUser("user-one", "u@example.com");
    const projectId = await createProject(userId);

    const res = await execute<{ projectUser: unknown | null }>(
      stack.apollo,
      PROJECT_USER,
      { projectId },
      { currentUser: null },
    );
    expect(res.errors?.[0]?.message).toBe("Not authenticated");
  });
});
