import { Types } from "mongoose";
import type { ProjectClip } from "../entities/ProjectClip";
import { ProjectData, ProjectDataModel } from "../entities/ProjectData";

/** An embedded track to seed onto a new {@link ProjectData}. */
export interface CreateProjectTrackData {
  name: string;
  creator: string;
}

/** Initial content to seed onto a new {@link ProjectData}. */
export interface CreateProjectDataInput {
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

  async create(input: CreateProjectDataInput = {}): Promise<ProjectData> {
    const doc = await ProjectDataModel.create({ tracks: input.tracks ?? [] });
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
}
