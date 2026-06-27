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
}
