import { Types } from "mongoose";
import type { ClipMode, ProjectClip } from "../entities/ProjectClip";
import type { AudioInClip } from "../entities/AudioInClip";
import { ProjectData, ProjectDataModel } from "../entities/ProjectData";

/** An embedded track to seed onto a new {@link ProjectData}. */
export interface CreateProjectTrackData {
  name: string;
  creator: string;
}

/** The fields needed to append an embedded {@link ProjectTrack}. */
export interface AddTrackData {
  name: string;
  creator: string;
}

/** Initial content to seed onto a new {@link ProjectData}. */
export interface CreateProjectDataInput {
  /** `_id` of the owning {@link Project} (stored as a back-reference). */
  project: string;
  tracks?: CreateProjectTrackData[];
}

/** Fields needed for each embedded {@link AudioInClip} at creation time. */
export interface AddAudioInClipData {
  start: number;
  duration: number;
  audioOffset: number;
}

/** The fields needed to append an embedded {@link ProjectClip}. */
export interface AddClipData {
  start: number;
  duration: number;
  maxDuration: number;
  mode: ClipMode;
  audioOffset: number;
  audioInClips: AddAudioInClipData[];
  /** `_id` of the embedded `ProjectTrack` the clip lives on. */
  track: string;
  /** `_id` of the `ProjectAudio` the clip plays. */
  audio: string;
  creator: string;
}

/**
 * The placement fields an embedded {@link ProjectClip} can be moved by. Each is
 * optional so callers update only what changed; an empty patch is a no-op.
 */
export interface UpdateClipData {
  /** New timeline start position, in samples. */
  start?: number;
  /** New clip length, in samples. Clamped to `maxDuration` by the service. */
  duration?: number;
  /** `_id` of the `ProjectTrack` the clip should now live on. */
  track?: string;
  /** Updated audio-in-clip placements (e.g. after repositioning the clip). */
  audioInClips?: AudioInClip[];
}

/**
 * Data-access layer for {@link ProjectData}. The only place that touches the
 * Typegoose model directly.
 */
export class ProjectDataRepository {
  findById(id: string): Promise<ProjectData | null> {
    return ProjectDataModel.findById(id).lean<ProjectData>().exec();
  }

  async create(input: CreateProjectDataInput): Promise<ProjectData> {
    const doc = await ProjectDataModel.create({
      project: input.project,
      tracks: input.tracks ?? [],
    });
    return doc.toObject<ProjectData>();
  }

  /**
   * Append a clip to a {@link ProjectData}'s embedded `clips` array, returning
   * the newly-created subdocument. The clip's `_id` is generated up front so it
   * can be located in the updated document and returned to the caller.
   */
  async addClip(projectDataId: string, data: AddClipData): Promise<ProjectClip> {
    const audioInClips = data.audioInClips.map((aic) => ({
      _id: new Types.ObjectId().toHexString(),
      ...aic,
    }));
    const clip = {
      _id: new Types.ObjectId().toHexString(),
      ...data,
      audioInClips,
    };
    const doc = await ProjectDataModel.findByIdAndUpdate(
      projectDataId,
      { $push: { clips: clip } },
      { returnDocument: "after" },
    )
      .lean<ProjectData>()
      .exec();
    if (!doc) throw new Error(`ProjectData not found: ${projectDataId}`);
    const created = doc.clips.find((c) => String(c._id) === clip._id);
    if (!created) throw new Error("Failed to append clip to ProjectData");
    return created;
  }

  /**
   * Archive (soft-remove) the embedded clips with the given ids on a
   * {@link ProjectData}, flipping their `archived` flag to `true` in a single
   * update. The clips are kept in storage (the underlying take is never lost);
   * they are simply hidden from the timeline. Returns the updated document.
   * A no-op when `clipIds` is empty.
   */
  async archiveClips(
    projectDataId: string,
    clipIds: string[],
  ): Promise<ProjectData> {
    if (clipIds.length === 0) {
      const existing = await this.findById(projectDataId);
      if (!existing) throw new Error(`ProjectData not found: ${projectDataId}`);
      return existing;
    }

    const doc = await ProjectDataModel.findByIdAndUpdate(
      projectDataId,
      { $set: { "clips.$[clip].archived": true } },
      {
        returnDocument: "after",
        arrayFilters: [{ "clip._id": { $in: clipIds } }],
      },
    )
      .lean<ProjectData>()
      .exec();
    if (!doc) throw new Error(`ProjectData not found: ${projectDataId}`);
    return doc;
  }

  /**
   * Update the placement of a single embedded clip (its timeline `start` and/or
   * the `track` it lives on), returning the updated subdocument. Only the
   * provided fields are written; an empty patch resolves to the unchanged clip
   * without touching the database.
   */
  async updateClip(
    projectDataId: string,
    clipId: string,
    data: UpdateClipData,
  ): Promise<ProjectClip> {
    const set: Record<string, number | string | AudioInClip[]> = {};
    if (data.start !== undefined) set["clips.$[clip].start"] = data.start;
    if (data.duration !== undefined) set["clips.$[clip].duration"] = data.duration;
    if (data.track !== undefined) set["clips.$[clip].track"] = data.track;
    if (data.audioInClips !== undefined) {
      set["clips.$[clip].audioInClips"] = data.audioInClips;
    }

    if (Object.keys(set).length === 0) {
      const existing = await this.findById(projectDataId);
      if (!existing) throw new Error(`ProjectData not found: ${projectDataId}`);
      const clip = existing.clips.find((c) => String(c._id) === clipId);
      if (!clip) throw new Error(`Clip not found: ${clipId}`);
      return clip;
    }

    const doc = await ProjectDataModel.findByIdAndUpdate(
      projectDataId,
      { $set: set },
      {
        returnDocument: "after",
        arrayFilters: [{ "clip._id": clipId }],
      },
    )
      .lean<ProjectData>()
      .exec();
    if (!doc) throw new Error(`ProjectData not found: ${projectDataId}`);
    const updated = doc.clips.find((c) => String(c._id) === clipId);
    if (!updated) throw new Error(`Clip not found: ${clipId}`);
    return updated;
  }

  /**
   * Append a track to a {@link ProjectData}'s embedded `tracks` array, returning
   * the updated document so callers can reflect the full new track list.
   */
  async addTrack(
    projectDataId: string,
    data: AddTrackData,
  ): Promise<ProjectData> {
    const track = { _id: new Types.ObjectId().toHexString(), ...data };
    const doc = await ProjectDataModel.findByIdAndUpdate(
      projectDataId,
      { $push: { tracks: track } },
      { returnDocument: "after" },
    )
      .lean<ProjectData>()
      .exec();
    if (!doc) throw new Error(`ProjectData not found: ${projectDataId}`);
    return doc;
  }

  /**
   * Remove an embedded track (and any clips that live on it) from a
   * {@link ProjectData}, returning the updated document. Pulling the track's
   * clips in the same update keeps the timeline from holding clips that
   * reference a track that no longer exists.
   */
  async removeTrack(
    projectDataId: string,
    trackId: string,
  ): Promise<ProjectData> {
    const doc = await ProjectDataModel.findByIdAndUpdate(
      projectDataId,
      { $pull: { tracks: { _id: trackId }, clips: { track: trackId } } },
      { returnDocument: "after" },
    )
      .lean<ProjectData>()
      .exec();
    if (!doc) throw new Error(`ProjectData not found: ${projectDataId}`);
    return doc;
  }
}
