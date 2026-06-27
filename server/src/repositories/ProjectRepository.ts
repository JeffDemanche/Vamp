import { Project, ProjectModel } from "../entities/Project";

export interface CreateProjectData {
  /** Pre-generated id so memberships can reference the project before it exists. */
  _id: string;
  title: string;
  /** The owner's `ProjectUser` (membership) id. */
  owner: string;
  /** The contributors' `ProjectUser` (membership) ids. */
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
   * Projects whose `owner` or `contributors` are any of the given membership
   * (`ProjectUser`) ids, newest first. Archived projects are excluded unless
   * `includeArchived` is set.
   */
  findByMemberships(
    membershipIds: string[],
    includeArchived = false,
  ): Promise<Project[]> {
    const filter: Record<string, unknown> = {
      $or: [
        { owner: { $in: membershipIds } },
        { contributors: { $in: membershipIds } },
      ],
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
