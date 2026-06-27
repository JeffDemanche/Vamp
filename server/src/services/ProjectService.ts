import { Types } from "mongoose";
import type { Project } from "../entities/Project";
import { generateProjectName } from "../lib/projectName";
import type { ProjectRepository } from "../repositories/ProjectRepository";
import type { ProjectDataService } from "./ProjectDataService";
import type { ProjectUserService } from "./ProjectUserService";

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
    private readonly projectUsers: ProjectUserService,
  ) {}

  findById(id: string): Promise<Project | null> {
    return this.projects.findById(id);
  }

  /**
   * Projects the given user owns or contributes to. Resolved through the user's
   * `ProjectUser` memberships (which `owner`/`contributors` reference). Archived
   * projects are excluded unless `includeArchived` is set.
   */
  async findByUser(userId: string, includeArchived = false): Promise<Project[]> {
    const membershipIds = await this.projectUsers.findIdsByUser(userId);
    if (membershipIds.length === 0) return [];
    return this.projects.findByMemberships(membershipIds, includeArchived);
  }

  /**
   * Create a project together with its backing {@link ProjectData} and the
   * {@link ProjectUser} memberships for its owner and contributors. The project
   * id is generated up front so the memberships can reference it before the
   * project document is written; `owner`/`contributors` then store membership
   * ids rather than bare user ids.
   */
  async create(input: CreateProjectInput): Promise<Project> {
    const projectId = new Types.ObjectId().toHexString();
    const data = await this.projectData.create(input.ownerId);

    const ownerMembership = await this.projectUsers.ensureMembership(
      projectId,
      input.ownerId,
    );
    const contributorMemberships = await Promise.all(
      (input.contributorIds ?? []).map((userId) =>
        this.projectUsers.ensureMembership(projectId, userId),
      ),
    );

    return this.projects.create({
      _id: projectId,
      title: input.title,
      owner: String(ownerMembership._id),
      contributors: contributorMemberships.map((m) => String(m._id)),
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
