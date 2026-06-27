import { Project, ProjectModel } from "../entities/Project";

export interface CreateProjectData {
  title: string;
  owner: string;
  contributors: string[];
  projectData: string;
}

/** Fields on a {@link Project} document that may be patched in place. */
export interface UpdateProjectData {
  title?: string;
  archived?: boolean;
}

/**
 * Data-access layer for {@link Project}. The only place that touches the
 * Typegoose model directly.
 */
export class ProjectRepository {
  findById(id: string): Promise<Project | null> {
    return ProjectModel.findById(id).lean<Project>().exec();
  }

  /**
   * Projects a user owns or is a contributor on, newest first. Archived
   * projects are excluded unless `includeArchived` is set.
   */
  findByUser(userId: string, includeArchived = false): Promise<Project[]> {
    const filter: Record<string, unknown> = {
      $or: [{ owner: userId }, { contributors: userId }],
    };
    if (!includeArchived) {
      filter.archived = { $ne: true };
    }
    return ProjectModel.find(filter)
      .sort({ createdAt: -1 })
      .lean<Project[]>()
      .exec();
  }

  async create(data: CreateProjectData): Promise<Project> {
    const doc = await ProjectModel.create(data);
    return doc.toObject<Project>();
  }

  /** Patch the given fields on a project, returning the updated document. */
  update(id: string, data: UpdateProjectData): Promise<Project | null> {
    return ProjectModel.findByIdAndUpdate(id, data, { returnDocument: "after" })
      .lean<Project>()
      .exec();
  }
}
