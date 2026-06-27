import { ProjectData, ProjectDataModel } from "../entities/ProjectData";

/**
 * Data-access layer for {@link ProjectData}. The only place that touches the
 * Typegoose model directly.
 */
export class ProjectDataRepository {
  findById(id: string): Promise<ProjectData | null> {
    return ProjectDataModel.findById(id).lean<ProjectData>().exec();
  }

  async create(): Promise<ProjectData> {
    const doc = await ProjectDataModel.create({});
    return doc.toObject<ProjectData>();
  }
}
