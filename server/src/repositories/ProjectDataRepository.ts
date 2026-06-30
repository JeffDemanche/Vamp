import { Types } from "mongoose";
import type { ProjectClip } from "../entities/ProjectClip";
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

/** The fields needed to append an embedded {@link ProjectClip}. */
export interface AddClipData {
  start: number;
  duration: number;
  audioOffset: number;
  /** `_id` of the embedded `ProjectTrack` the clip lives on. */
  track: string;
  /** `_id` of the `ProjectAudio` the clip plays. */
  audio: string;
  creator: string;
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
    const clip = { _id: new Types.ObjectId().toHexString(), ...data };
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
