import type { Project } from "../entities/Project";
import type { ProjectRepository } from "../repositories/ProjectRepository";
import type { ProjectDataService } from "./ProjectDataService";

export interface CreateProjectInput {
  title: string;
  ownerId: string;
  contributorIds?: string[];
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

  /** Projects the given user owns or contributes to. */
  findByUser(userId: string): Promise<Project[]> {
    return this.projects.findByUser(userId);
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
}
