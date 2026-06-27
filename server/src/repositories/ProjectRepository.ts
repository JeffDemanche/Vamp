import { Project, ProjectModel } from "../entities/Project";

export interface CreateProjectData {
  title: string;
  owner: string;
  contributors: string[];
  projectData: string;
}

/**
 * Data-access layer for {@link Project}. The only place that touches the
 * Typegoose model directly.
 */
export class ProjectRepository {
  findById(id: string): Promise<Project | null> {
    return ProjectModel.findById(id).lean<Project>().exec();
  }

  /** Projects a user owns or is a contributor on, newest first. */
  findByUser(userId: string): Promise<Project[]> {
    return ProjectModel.find({
      $or: [{ owner: userId }, { contributors: userId }],
    })
      .sort({ createdAt: -1 })
      .lean<Project[]>()
      .exec();
  }

  async create(data: CreateProjectData): Promise<Project> {
    const doc = await ProjectModel.create(data);
    return doc.toObject<Project>();
  }
}
