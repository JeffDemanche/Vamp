import { Types } from "mongoose";
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
        }
      }
    }
  }
`;

const ARCHIVE_CLIPS = /* GraphQL */ `
  mutation ArchiveClips($input: ArchiveClipsInput!) {
    archiveClips(input: $input) {
      _id
      clips {
        _id
      }
    }
  }
`;

const UPDATE_CLIP = /* GraphQL */ `
  mutation UpdateClip($input: UpdateClipInput!) {
    updateClip(input: $input) {
      _id
      start
      duration
      maxDuration
      track
      audioInClips {
        _id
        start
        duration
        audioOffset
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
): Promise<{ projectId: string; projectDataId: string; trackId: string }> {
  const res = await execute<{
    createEmptyProject: {
      _id: string;
      projectData: { _id: string; tracks: { _id: string }[] };
    };
  }>(stack.apollo, CREATE_EMPTY_PROJECT, { ownerId });
  const project = res.data!.createEmptyProject;
  return {
    projectId: project._id,
    projectDataId: project.projectData._id,
    trackId: project.projectData.tracks[0]!._id,
  };
}

/**
 * Seed `count` embedded clips straight onto the project's `ProjectData`,
 * bypassing the upload flow (which needs object storage). Returns the new
 * clips' ids in order.
 */
async function seedClips(
  projectDataId: string,
  trackId: string,
  creatorId: string,
  count: number,
): Promise<string[]> {
  const clips = Array.from({ length: count }, (_, i) => ({
    _id: new Types.ObjectId().toHexString(),
    start: i * 1000,
    duration: 1000,
    maxDuration: 1000,
    mode: "FLAT",
    audioOffset: 0,
    audioInClips: [
      {
        _id: new Types.ObjectId().toHexString(),
        start: i * 1000,
        duration: 1000,
        audioOffset: 0,
      },
    ],
    track: trackId,
    audio: new Types.ObjectId().toHexString(),
    creator: creatorId,
  }));
  await ProjectDataModel.findByIdAndUpdate(projectDataId, {
    $push: { clips: { $each: clips } },
  }).exec();
  return clips.map((c) => c._id);
}

/** Push an extra embedded track onto a project's `ProjectData`, returning its id. */
async function addTrack(
  projectDataId: string,
  creatorId: string,
  name: string,
): Promise<string> {
  const trackId = new Types.ObjectId().toHexString();
  await ProjectDataModel.findByIdAndUpdate(projectDataId, {
    $push: { tracks: { _id: trackId, name, creator: creatorId } },
  }).exec();
  return trackId;
}

describe("ProjectClip API (updateClip)", () => {
  it("repositions a clip's start without changing its track", async () => {
    const ownerId = await createUser("owner", "owner@example.com");
    const { projectId, projectDataId, trackId } = await createProject(ownerId);
    const [clipA] = await seedClips(projectDataId, trackId, ownerId, 1);

    const res = await execute<{
      updateClip: { _id: string; start: number; track: string };
    }>(
      stack.apollo,
      UPDATE_CLIP,
      { input: { projectId, clipId: clipA, start: 5000 } },
      asUser(ownerId),
    );

    expect(res.errors).toBeUndefined();
    expect(res.data!.updateClip).toMatchObject({
      _id: clipA,
      start: 5000,
      track: trackId,
    });

    const data = await ProjectDataModel.findById(projectDataId).lean();
    const stored = data?.clips.find((c) => String(c._id) === clipA);
    expect(stored?.start).toBe(5000);
    expect(String(stored?.track)).toBe(trackId);
    expect(stored?.audioInClips[0]?.start).toBe(5000);
  });

  it("moves a clip onto another track (and can reposition it at once)", async () => {
    const ownerId = await createUser("owner", "owner@example.com");
    const { projectId, projectDataId, trackId } = await createProject(ownerId);
    const trackB = await addTrack(projectDataId, ownerId, "Track 2");
    const [clipA] = await seedClips(projectDataId, trackId, ownerId, 1);

    const res = await execute<{
      updateClip: { _id: string; start: number; track: string };
    }>(
      stack.apollo,
      UPDATE_CLIP,
      { input: { projectId, clipId: clipA, start: 12000, track: trackB } },
      asUser(ownerId),
    );

    expect(res.errors).toBeUndefined();
    expect(res.data!.updateClip).toMatchObject({
      _id: clipA,
      start: 12000,
      track: trackB,
    });

    const data = await ProjectDataModel.findById(projectDataId).lean();
    const stored = data?.clips.find((c) => String(c._id) === clipA);
    expect(String(stored?.track)).toBe(trackB);
    expect(stored?.start).toBe(12000);
  });

  it("does not rewrite audioInClip duration when trimming a clip", async () => {
    const ownerId = await createUser("owner", "owner@example.com");
    const { projectId, projectDataId, trackId } = await createProject(ownerId);
    const [clipA] = await seedClips(projectDataId, trackId, ownerId, 1);

    const res = await execute<{
      updateClip: { duration: number; audioInClips: { duration: number }[] };
    }>(
      stack.apollo,
      UPDATE_CLIP,
      { input: { projectId, clipId: clipA, duration: 500 } },
      asUser(ownerId),
    );

    expect(res.errors).toBeUndefined();
    expect(res.data!.updateClip.duration).toBe(500);
    expect(res.data!.updateClip.audioInClips[0]?.duration).toBe(1000);

    const data = await ProjectDataModel.findById(projectDataId).lean();
    const stored = data?.clips.find((c) => String(c._id) === clipA);
    expect(stored?.duration).toBe(500);
    expect(stored?.audioInClips[0]?.duration).toBe(1000);
  });

  it("clamps duration to maxDuration when shortening a clip", async () => {
    const ownerId = await createUser("owner", "owner@example.com");
    const { projectId, projectDataId, trackId } = await createProject(ownerId);
    const [clipA] = await seedClips(projectDataId, trackId, ownerId, 1);

    const res = await execute<{
      updateClip: { _id: string; duration: number; maxDuration: number };
    }>(
      stack.apollo,
      UPDATE_CLIP,
      { input: { projectId, clipId: clipA, duration: 500 } },
      asUser(ownerId),
    );

    expect(res.errors).toBeUndefined();
    expect(res.data!.updateClip).toMatchObject({
      _id: clipA,
      duration: 500,
      maxDuration: 1000,
    });
  });

  it("rejects lengthening a clip past maxDuration", async () => {
    const ownerId = await createUser("owner", "owner@example.com");
    const { projectId, projectDataId, trackId } = await createProject(ownerId);
    const [clipA] = await seedClips(projectDataId, trackId, ownerId, 1);

    const res = await execute<{
      updateClip: { _id: string; duration: number; maxDuration: number };
    }>(
      stack.apollo,
      UPDATE_CLIP,
      { input: { projectId, clipId: clipA, duration: 2000 } },
      asUser(ownerId),
    );

    expect(res.errors).toBeUndefined();
    expect(res.data!.updateClip.duration).toBe(1000);
  });

  it("requires authentication to move a clip", async () => {
    const ownerId = await createUser("owner", "owner@example.com");
    const { projectId, projectDataId, trackId } = await createProject(ownerId);
    const [clipA] = await seedClips(projectDataId, trackId, ownerId, 1);

    const res = await execute<{ updateClip: unknown | null }>(
      stack.apollo,
      UPDATE_CLIP,
      { input: { projectId, clipId: clipA, start: 5000 } },
      { currentUser: null },
    );

    expect(res.data?.updateClip ?? null).toBeNull();
    expect(res.errors?.[0]?.message).toBe("Not authenticated");
  });
});

describe("ProjectClip API (archiveClips)", () => {
  it("archives a single clip, hiding it from the timeline", async () => {
    const ownerId = await createUser("owner", "owner@example.com");
    const { projectId, projectDataId, trackId } = await createProject(ownerId);
    const [clipA, clipB] = await seedClips(projectDataId, trackId, ownerId, 2);

    const res = await execute<{ archiveClips: { _id: string; clips: { _id: string }[] } }>(
      stack.apollo,
      ARCHIVE_CLIPS,
      { input: { projectId, clipIds: [clipA] } },
      asUser(ownerId),
    );

    expect(res.errors).toBeUndefined();
    // The archived clip is filtered out of the exposed clips; clipB remains.
    expect(res.data!.archiveClips.clips.map((c) => c._id)).toEqual([clipB]);

    // Both clips are still stored; only clipA is flagged archived.
    const data = await ProjectDataModel.findById(projectDataId).lean();
    expect(data?.clips).toHaveLength(2);
    const stored = Object.fromEntries(
      (data?.clips ?? []).map((c) => [String(c._id), c.archived]),
    );
    expect(stored[clipA]).toBe(true);
    expect(stored[clipB]).toBe(false);
  });

  it("archives multiple clips at once", async () => {
    const ownerId = await createUser("owner", "owner@example.com");
    const { projectId, projectDataId, trackId } = await createProject(ownerId);
    const [clipA, clipB, clipC] = await seedClips(projectDataId, trackId, ownerId, 3);

    const res = await execute<{ archiveClips: { clips: { _id: string }[] } }>(
      stack.apollo,
      ARCHIVE_CLIPS,
      { input: { projectId, clipIds: [clipA, clipC] } },
      asUser(ownerId),
    );

    expect(res.errors).toBeUndefined();
    expect(res.data!.archiveClips.clips.map((c) => c._id)).toEqual([clipB]);
  });

  it("requires authentication to archive clips", async () => {
    const ownerId = await createUser("owner", "owner@example.com");
    const { projectId, projectDataId, trackId } = await createProject(ownerId);
    const [clipA] = await seedClips(projectDataId, trackId, ownerId, 1);

    const res = await execute<{ archiveClips: unknown | null }>(
      stack.apollo,
      ARCHIVE_CLIPS,
      { input: { projectId, clipIds: [clipA] } },
      { currentUser: null },
    );

    expect(res.data?.archiveClips ?? null).toBeNull();
    expect(res.errors?.[0]?.message).toBe("Not authenticated");
  });
});
