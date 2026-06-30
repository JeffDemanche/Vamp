import type { ProjectClip } from "../entities/ProjectClip";
import { ClipMode } from "../entities/ProjectClip";
import type { ProjectData } from "../entities/ProjectData";
import { refToId } from "../lib/ref";
import type { ProjectAudioService } from "./ProjectAudioService";
import type { ProjectDataService } from "./ProjectDataService";
import type { ProjectService } from "./ProjectService";

/** Everything needed to place a clip on a project's timeline. */
export interface CreateClipInput {
  projectId: string;
  /** `_id` of the embedded `ProjectTrack` the clip lives on. */
  trackId: string;
  /** `_id` of the `ProjectAudio` (already uploaded) the clip plays. */
  audioId: string;
  /** Timeline start position, in samples. */
  start: number;
  /** Clip length, in samples. */
  duration: number;
  /** How the clip schedules its underlying audio. Defaults to `FLAT`. */
  mode?: ClipMode;
  /** Offset into the underlying audio to begin at, in samples. */
  audioOffset: number;
  creatorId: string;
}

/** Identifies a set of clips to archive (soft-remove) from a project. */
export interface ArchiveClipsInput {
  projectId: string;
  /** `_id`s of the embedded `ProjectClip`s to archive. */
  clipIds: string[];
}

/** Identifies a clip to move on a project's timeline and the placement to set. */
export interface UpdateClipInput {
  projectId: string;
  /** `_id` of the embedded `ProjectClip` to update. */
  clipId: string;
  /** New timeline start position, in samples. Omit to leave unchanged. */
  start?: number;
  /** New clip length, in samples. Omit to leave unchanged. Clamped to `maxDuration`. */
  duration?: number;
  /** `_id` of the `ProjectTrack` the clip should move to. Omit to leave unchanged. */
  track?: string;
}

/**
 * Business logic for creating {@link ProjectClip}s — the orchestration that ties
 * an uploaded {@link ProjectAudio} to a position on a project's timeline.
 * Depends on other services (not repositories) since a clip spans the project,
 * its data, and its audio.
 */
export class ProjectClipService {
  constructor(
    private readonly projects: ProjectService,
    private readonly projectData: ProjectDataService,
    private readonly audios: ProjectAudioService,
  ) {}

  /**
   * Place a clip on the project's timeline. Confirms the referenced audio has
   * finished uploading (flipping it to `Ready`) and that it belongs to the same
   * project before appending the clip to the project's `ProjectData`.
   */
  async create(input: CreateClipInput): Promise<ProjectClip> {
    const project = await this.projects.findById(input.projectId);
    if (!project) throw new Error(`Project not found: ${input.projectId}`);

    // Ensure the upload landed (and is now `Ready`) before linking it.
    const audio = await this.audios.confirmUploaded(input.audioId);
    if (refToId(audio.project) !== input.projectId) {
      throw new Error("Audio does not belong to this project");
    }

    return this.projectData.addClip(refToId(project.projectData), {
      start: input.start,
      duration: input.duration,
      maxDuration: input.duration,
      mode: input.mode ?? ClipMode.FLAT,
      audioOffset: input.audioOffset,
      track: input.trackId,
      audio: input.audioId,
      creator: input.creatorId,
    });
  }

  /**
   * Move a clip on the project's timeline — updating its `start` and/or the
   * `track` it lives on — returning the updated clip. Used by the editor's
   * drag-and-drop, which repositions a clip horizontally and can drop it onto a
   * different track.
   */
  async update(input: UpdateClipInput): Promise<ProjectClip> {
    const project = await this.projects.findById(input.projectId);
    if (!project) throw new Error(`Project not found: ${input.projectId}`);

    const projectDataId = refToId(project.projectData);
    let duration = input.duration;
    if (duration !== undefined) {
      const data = await this.projectData.findById(projectDataId);
      if (!data) throw new Error(`ProjectData not found: ${projectDataId}`);
      const clip = data.clips.find((c) => String(c._id) === input.clipId);
      if (!clip) throw new Error(`Clip not found: ${input.clipId}`);
      duration = clampDuration(duration, clip.maxDuration);
    }

    return this.projectData.updateClip(projectDataId, input.clipId, {
      start: input.start,
      duration,
      track: input.track,
    });
  }

  /**
   * Archive (soft-remove) one or more clips from a project's timeline,
   * returning the updated {@link ProjectData}. Archived clips are retained in
   * storage but no longer appear on the timeline, mirroring the way
   * `deleteTrack` returns the updated data so the client can refresh from a
   * single normalized cache entry.
   */
  async archive(input: ArchiveClipsInput): Promise<ProjectData> {
    const project = await this.projects.findById(input.projectId);
    if (!project) throw new Error(`Project not found: ${input.projectId}`);

    return this.projectData.archiveClips(
      refToId(project.projectData),
      input.clipIds,
    );
  }
}

/** Clamp a requested clip duration to `[1, maxDuration]`. */
function clampDuration(duration: number, maxDuration: number): number {
  return Math.min(Math.max(Math.round(duration), 1), maxDuration);
}
