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

const CREATE_TRACK = /* GraphQL */ `
  mutation CreateTrack($input: CreateTrackInput!) {
    createTrack(input: $input) {
      _id
      tracks {
        _id
        name
      }
    }
  }
`;

const DELETE_TRACK = /* GraphQL */ `
  mutation DeleteTrack($input: DeleteTrackInput!) {
    deleteTrack(input: $input) {
      _id
      tracks {
        _id
        name
      }
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

/** Context override authenticating requests as the given user. */
function asUser(id: string): Partial<{ currentUser: User }> {
  return { currentUser: { _id: id } as User };
}

async function createUser(username: string, email: string): Promise<string> {
  const res = await execute<{ register: { _id: string } }>(stack.apollo, REGISTER, {
    input: { username, email, password: "a-good-password" },
  });
  return res.data!.register._id;
}

async function createProject(
  ownerId: string,
): Promise<{ projectId: string; trackId: string }> {
  const res = await execute<{
    createEmptyProject: {
      _id: string;
      projectData: { _id: string; tracks: { _id: string }[] };
    };
  }>(stack.apollo, CREATE_EMPTY_PROJECT, { ownerId });
  const project = res.data!.createEmptyProject;
  return { projectId: project._id, trackId: project.projectData.tracks[0]!._id };
}

interface TrackList {
  _id: string;
  tracks: { _id: string; name: string }[];
}

describe("ProjectTrack API (create + delete)", () => {
  it("adds a track with an auto-generated name", async () => {
    const ownerId = await createUser("owner", "owner@example.com");
    const { projectId } = await createProject(ownerId);

    const res = await execute<{ createTrack: TrackList }>(
      stack.apollo,
      CREATE_TRACK,
      { input: { projectId } },
      asUser(ownerId),
    );

    expect(res.errors).toBeUndefined();
    const tracks = res.data!.createTrack.tracks;
    // Starter "Track 1" plus the newly-added "Track 2".
    expect(tracks).toHaveLength(2);
    expect(tracks.map((t) => t.name)).toEqual(["Track 1", "Track 2"]);

    // The track is persisted on the project's ProjectData with its creator.
    const data = await ProjectDataModel.findOne().lean();
    expect(data?.tracks).toHaveLength(2);
    expect(String(data?.tracks[1]?.creator)).toBe(ownerId);
  });

  it("adds a track with an explicit name", async () => {
    const ownerId = await createUser("owner", "owner@example.com");
    const { projectId } = await createProject(ownerId);

    const res = await execute<{ createTrack: TrackList }>(
      stack.apollo,
      CREATE_TRACK,
      { input: { projectId, name: "Lead Vocal" } },
      asUser(ownerId),
    );

    expect(res.errors).toBeUndefined();
    expect(res.data!.createTrack.tracks.map((t) => t.name)).toContain("Lead Vocal");
  });

  it("deletes a track from the timeline", async () => {
    const ownerId = await createUser("owner", "owner@example.com");
    const { projectId, trackId } = await createProject(ownerId);

    const res = await execute<{ deleteTrack: TrackList }>(
      stack.apollo,
      DELETE_TRACK,
      { input: { projectId, trackId } },
      asUser(ownerId),
    );

    expect(res.errors).toBeUndefined();
    expect(res.data!.deleteTrack.tracks).toHaveLength(0);

    const data = await ProjectDataModel.findOne().lean();
    expect(data?.tracks ?? []).toHaveLength(0);
  });

  it("requires authentication to create a track", async () => {
    const ownerId = await createUser("owner", "owner@example.com");
    const { projectId } = await createProject(ownerId);

    const res = await execute<{ createTrack: unknown | null }>(
      stack.apollo,
      CREATE_TRACK,
      { input: { projectId } },
      { currentUser: null },
    );
    expect(res.data?.createTrack ?? null).toBeNull();
    expect(res.errors?.[0]?.message).toBe("Not authenticated");
  });
});
