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
    }
  }
`;

const SET_PROJECT_USER_PLAYBACK = /* GraphQL */ `
  mutation SetProjectUserPlayback($input: SetProjectUserPlaybackInput!) {
    setProjectUserPlayback(input: $input) {
      _id
      playStart
      playEnd
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
  it("returns null before any state is saved", async () => {
    const userId = await createUser("user-one", "u@example.com");
    const projectId = await createProject(userId);

    const res = await execute<{ projectUser: unknown | null }>(
      stack.apollo,
      PROJECT_USER,
      { projectId },
      asUser(userId),
    );
    expect(res.errors).toBeUndefined();
    expect(res.data?.projectUser).toBeNull();
  });

  it("upserts and reads back the playback range for the current user", async () => {
    const userId = await createUser("user-one", "u@example.com");
    const projectId = await createProject(userId);

    const saved = await execute<{
      setProjectUserPlayback: { _id: string; playStart: number; playEnd: number | null };
    }>(
      stack.apollo,
      SET_PROJECT_USER_PLAYBACK,
      { input: { projectId, playStart: 44_100, playEnd: 88_200 } },
      asUser(userId),
    );
    expect(saved.errors).toBeUndefined();
    expect(saved.data?.setProjectUserPlayback).toMatchObject({
      playStart: 44_100,
      playEnd: 88_200,
    });

    // A second save for the same (project, user) updates in place, not inserts.
    const updated = await execute<{
      setProjectUserPlayback: { _id: string; playStart: number; playEnd: number | null };
    }>(
      stack.apollo,
      SET_PROJECT_USER_PLAYBACK,
      { input: { projectId, playStart: 1_000, playEnd: null } },
      asUser(userId),
    );
    expect(updated.data?.setProjectUserPlayback._id).toBe(
      saved.data?.setProjectUserPlayback._id,
    );
    expect(updated.data?.setProjectUserPlayback).toMatchObject({
      playStart: 1_000,
      playEnd: null,
    });
    await expect(ProjectUserModel.countDocuments()).resolves.toBe(1);

    const fetched = await execute<{ projectUser: { playStart: number; playEnd: number | null } }>(
      stack.apollo,
      PROJECT_USER,
      { projectId },
      asUser(userId),
    );
    expect(fetched.data?.projectUser).toMatchObject({ playStart: 1_000, playEnd: null });
  });

  it("scopes state per user — another user sees their own (absent) state", async () => {
    const userA = await createUser("user-a", "a@example.com");
    const userB = await createUser("user-b", "b@example.com");
    const projectId = await createProject(userA);

    await execute(
      stack.apollo,
      SET_PROJECT_USER_PLAYBACK,
      { input: { projectId, playStart: 5_000, playEnd: null } },
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
