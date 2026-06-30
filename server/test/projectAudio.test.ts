import type { Readable } from "node:stream";
import { createServices, type Services } from "../src/container";
import { ProjectModel } from "../src/entities/Project";
import { ProjectAudioModel } from "../src/entities/ProjectAudio";
import { ProjectDataModel } from "../src/entities/ProjectData";
import { ProjectUserModel } from "../src/entities/ProjectUser";
import { UserModel } from "../src/entities/User";
import type { User } from "../src/entities/User";
import type { AudioStorage, StoredObjectInfo } from "../src/lib/audioStorage";
import { execute, startTestStack, stopTestStack, type TestStack } from "./testServer";

/**
 * In-memory {@link AudioStorage} standing in for a real backend. `head` only
 * reports objects that have been written (via {@link write} or the
 * {@link simulateUpload} helper), letting us drive the upload lifecycle
 * deterministically without real network or disk I/O.
 */
class FakeAudioStorage implements AudioStorage {
  readonly bucket = "test-bucket";
  private readonly objects = new Map<string, StoredObjectInfo>();

  async write(key: string, body: Readable, contentType: string): Promise<void> {
    let contentLength = 0;
    for await (const chunk of body) contentLength += (chunk as Buffer).length;
    this.objects.set(key, { contentLength, contentType });
  }

  createDownloadUrl(key: string): Promise<string> {
    return Promise.resolve(`https://fake.store/${key}?op=get`);
  }

  head(key: string): Promise<StoredObjectInfo | null> {
    return Promise.resolve(this.objects.get(key) ?? null);
  }

  /** Pretend the client finished uploading bytes for `key`. */
  simulateUpload(key: string, info: StoredObjectInfo): void {
    this.objects.set(key, info);
  }
}

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

const CREATE_AUDIO_UPLOAD = /* GraphQL */ `
  mutation CreateAudioUpload($input: CreateAudioUploadInput!) {
    createAudioUpload(input: $input) {
      uploadUrl
      audio {
        _id
        bucket
        key
        contentType
        uploadStatus
        byteSize
      }
    }
  }
`;

const CREATE_CLIP = /* GraphQL */ `
  mutation CreateClip($input: CreateClipInput!) {
    createClip(input: $input) {
      _id
      start
      duration
      audioOffset
      track
      audio {
        _id
        uploadStatus
        byteSize
        downloadUrl
      }
    }
  }
`;

const GET_PROJECT_CLIPS = /* GraphQL */ `
  query ProjectClips($id: ID!) {
    project(id: $id) {
      projectData {
        clips {
          _id
          start
          duration
          audioOffset
          audio {
            _id
            uploadStatus
          }
        }
      }
    }
  }
`;

const GET_PROJECT_AUDIOS = /* GraphQL */ `
  query ProjectAudios($id: ID!) {
    project(id: $id) {
      projectData {
        audios {
          _id
          uploadStatus
          downloadUrl
        }
      }
    }
  }
`;

let stack: TestStack;
let storage: FakeAudioStorage;
let services: Services;

beforeAll(async () => {
  stack = await startTestStack();
});

afterAll(async () => {
  await stopTestStack(stack);
});

beforeEach(() => {
  storage = new FakeAudioStorage();
  services = createServices({ audioStorage: storage });
});

afterEach(async () => {
  await Promise.all([
    ProjectModel.deleteMany({}),
    ProjectDataModel.deleteMany({}),
    ProjectUserModel.deleteMany({}),
    ProjectAudioModel.deleteMany({}),
    UserModel.deleteMany({}),
  ]);
});

/** Context override: the fake-storage services plus a `currentUser`. */
function asUser(id: string): Partial<{ currentUser: User; services: Services }> {
  return { currentUser: { _id: id } as User, services };
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

interface AudioUpload {
  uploadUrl: string;
  audio: {
    _id: string;
    bucket: string;
    key: string;
    contentType: string;
    uploadStatus: string;
    byteSize: number | null;
  };
}

async function startUpload(
  userId: string,
  projectId: string,
  contentType = "audio/wav",
): Promise<AudioUpload> {
  const res = await execute<{ createAudioUpload: AudioUpload }>(
    stack.apollo,
    CREATE_AUDIO_UPLOAD,
    { input: { projectId, contentType } },
    asUser(userId),
  );
  expect(res.errors).toBeUndefined();
  return res.data!.createAudioUpload;
}

describe("ProjectAudio + ProjectClip API (presigned upload -> clip)", () => {
  it("registers a pending audio and hands back a presigned upload URL", async () => {
    const userId = await createUser("owner", "owner@example.com");
    const { projectId } = await createProject(userId);

    const upload = await startUpload(userId, projectId);

    expect(upload.uploadUrl).toContain(`/audio/upload/${upload.audio._id}`);
    expect(upload.audio.bucket).toBe("test-bucket");
    expect(upload.audio.key).toContain(`projects/${projectId}/audio/`);
    expect(upload.audio.contentType).toBe("audio/wav");
    expect(upload.audio.uploadStatus).toBe("PENDING");
    expect(upload.audio.byteSize).toBeNull();
  });

  it("creates a clip that confirms the upload and references the audio", async () => {
    const userId = await createUser("owner", "owner@example.com");
    const { projectId, trackId } = await createProject(userId);

    const upload = await startUpload(userId, projectId);
    // Simulate the browser finishing its PUT straight to S3.
    storage.simulateUpload(upload.audio.key, { contentLength: 2_048, contentType: "audio/wav" });

    const res = await execute<{
      createClip: {
        _id: string;
        start: number;
        duration: number;
        audioOffset: number;
        track: string;
        audio: { _id: string; uploadStatus: string; byteSize: number; downloadUrl: string };
      };
    }>(
      stack.apollo,
      CREATE_CLIP,
      {
        input: {
          projectId,
          trackId,
          audioId: upload.audio._id,
          start: 44_100,
          duration: 88_200,
          audioOffset: 1_024,
        },
      },
      asUser(userId),
    );

    expect(res.errors).toBeUndefined();
    const clip = res.data!.createClip;
    expect(clip.start).toBe(44_100);
    expect(clip.duration).toBe(88_200);
    expect(clip.audioOffset).toBe(1_024);
    expect(clip.track).toBe(trackId);
    // The audio flipped to READY and captured the stored object size.
    expect(clip.audio._id).toBe(upload.audio._id);
    expect(clip.audio.uploadStatus).toBe("READY");
    expect(clip.audio.byteSize).toBe(2_048);
    expect(clip.audio.downloadUrl).toContain("op=get");
    expect(clip.audio.downloadUrl).toContain(upload.audio.key);

    // The clip is embedded on the project's ProjectData and reads back.
    const fetched = await execute<{
      project: {
        projectData: {
          clips: { _id: string; audioOffset: number; audio: { uploadStatus: string } }[];
        };
      };
    }>(stack.apollo, GET_PROJECT_CLIPS, { id: projectId }, asUser(userId));
    const clips = fetched.data!.project.projectData.clips;
    expect(clips).toHaveLength(1);
    expect(clips[0]).toMatchObject({
      _id: clip._id,
      audioOffset: 1_024,
      audio: { uploadStatus: "READY" },
    });
  });

  it("defaults audioOffset to 0 when omitted", async () => {
    const userId = await createUser("owner", "owner@example.com");
    const { projectId, trackId } = await createProject(userId);

    const upload = await startUpload(userId, projectId);
    storage.simulateUpload(upload.audio.key, { contentLength: 10 });

    const res = await execute<{ createClip: { audioOffset: number } }>(
      stack.apollo,
      CREATE_CLIP,
      {
        input: {
          projectId,
          trackId,
          audioId: upload.audio._id,
          start: 0,
          duration: 100,
        },
      },
      asUser(userId),
    );
    expect(res.errors).toBeUndefined();
    expect(res.data?.createClip.audioOffset).toBe(0);
  });

  it("refuses to create a clip when the audio was never uploaded", async () => {
    const userId = await createUser("owner", "owner@example.com");
    const { projectId, trackId } = await createProject(userId);

    const upload = await startUpload(userId, projectId);
    // Note: no simulateUpload — the bytes never landed in S3.

    const res = await execute<{ createClip: unknown | null }>(
      stack.apollo,
      CREATE_CLIP,
      {
        input: {
          projectId,
          trackId,
          audioId: upload.audio._id,
          start: 0,
          duration: 100,
        },
      },
      asUser(userId),
    );
    expect(res.data?.createClip ?? null).toBeNull();
    expect(res.errors?.[0]?.message).toMatch(/upload did not complete/);

    // Nothing was appended to the timeline.
    const data = await ProjectDataModel.findOne().lean();
    expect(data?.clips ?? []).toHaveLength(0);
  });

  it("resolves all audios belonging to the project via projectData.audios", async () => {
    const userId = await createUser("owner", "owner@example.com");
    const { projectId, trackId } = await createProject(userId);

    // One audio that becomes a clip (flips to READY), and one that stays
    // pending (uploaded but never linked).
    const linked = await startUpload(userId, projectId);
    storage.simulateUpload(linked.audio.key, { contentLength: 2_048 });
    await execute(
      stack.apollo,
      CREATE_CLIP,
      {
        input: {
          projectId,
          trackId,
          audioId: linked.audio._id,
          start: 0,
          duration: 100,
        },
      },
      asUser(userId),
    );
    const pending = await startUpload(userId, projectId);

    // A second project's audio must not leak into the first project's library.
    const other = await createProject(userId);
    await startUpload(userId, other.projectId);

    const res = await execute<{
      project: {
        projectData: {
          audios: { _id: string; uploadStatus: string; downloadUrl: string | null }[];
        };
      };
    }>(stack.apollo, GET_PROJECT_AUDIOS, { id: projectId }, asUser(userId));

    expect(res.errors).toBeUndefined();
    const audios = res.data!.project.projectData.audios;
    expect(audios.map((a) => a._id).sort()).toEqual(
      [linked.audio._id, pending.audio._id].sort(),
    );

    const linkedAudio = audios.find((a) => a._id === linked.audio._id)!;
    expect(linkedAudio.uploadStatus).toBe("READY");
    expect(linkedAudio.downloadUrl).toContain("op=get");

    const pendingAudio = audios.find((a) => a._id === pending.audio._id)!;
    expect(pendingAudio.uploadStatus).toBe("PENDING");
    expect(pendingAudio.downloadUrl).toBeNull();
  });

  it("requires authentication to start an upload", async () => {
    const res = await execute<{ createAudioUpload: unknown | null }>(
      stack.apollo,
      CREATE_AUDIO_UPLOAD,
      { input: { projectId: "anything", contentType: "audio/wav" } },
      { currentUser: null, services },
    );
    expect(res.errors?.[0]?.message).toBe("Not authenticated");
  });
});
