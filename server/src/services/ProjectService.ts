import type { Project } from "../entities/Project";
import { generateProjectName } from "../lib/projectName";
import type { ProjectRepository } from "../repositories/ProjectRepository";
import type { ProjectDataService } from "./ProjectDataService";

export interface CreateProjectInput {
  title: string;
  ownerId: string;
  contributorIds?: string[];
}

/** Metadata fields on a {@link Project} itself (not its {@link ProjectData}). */
export interface UpdateProjectMetadataInput {
  title?: string;
}

/**
 * Business logic for {@link Project}. Orchestrates across repositories and
 * other services — e.g. creating a project also provisions its backing
 * {@link ProjectData}.
 */
export class ProjectService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly projectData: ProjectDataService,
  ) {}

  findById(id: string): Promise<Project | null> {
    return this.projects.findById(id);
  }

  /**
   * Projects the given user owns or contributes to. Archived projects are
   * excluded unless `includeArchived` is set.
   */
  findByUser(userId: string, includeArchived = false): Promise<Project[]> {
    return this.projects.findByUser(userId, includeArchived);
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const data = await this.projectData.create();
    return this.projects.create({
      title: input.title,
      owner: input.ownerId,
      contributors: input.contributorIds ?? [],
      projectData: String(data._id),
    });
  }

  /**
   * Create a new empty project for an owner. The title is auto-generated as a
   * short poetic name (see {@link generateProjectName}); backing
   * {@link ProjectData} is provisioned as with any project.
   */
  createEmpty(ownerId: string): Promise<Project> {
    return this.create({ title: generateProjectName(), ownerId });
  }

  /** Archive or unarchive a project. */
  async setArchived(id: string, archived: boolean): Promise<Project> {
    const project = await this.projects.update(id, { archived });
    if (!project) throw new Error(`Project not found: ${id}`);
    return project;
  }

  /**
   * Update metadata stored directly on the {@link Project} (e.g. its title).
   * Editing the project's content goes through separate `ProjectData` flows.
   */
  async updateMetadata(
    id: string,
    input: UpdateProjectMetadataInput,
  ): Promise<Project> {
    const project = await this.projects.update(id, input);
    if (!project) throw new Error(`Project not found: ${id}`);
    return project;
  }
}
