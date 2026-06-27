import type { ProjectData } from "../entities/ProjectData";
import type { ProjectDataRepository } from "../repositories/ProjectDataRepository";

/**
 * Business logic for {@link ProjectData}. Depends on the repository layer,
 * never on the Typegoose model directly.
 */
export class ProjectDataService {
  constructor(private readonly projectData: ProjectDataRepository) {}

  findById(id: string): Promise<ProjectData | null> {
    return this.projectData.findById(id);
  }

  /**
   * Provision a new {@link ProjectData}, seeded with a single starter track
   * owned by `creatorId` (the project's creator).
   */
  create(creatorId: string): Promise<ProjectData> {
    return this.projectData.create({
      tracks: [{ name: "Track 1", creator: creatorId }],
    });
  }
}
