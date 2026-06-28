import type { ProjectData } from "../entities/ProjectData";
import { refToId } from "../lib/ref";
import type { ProjectDataService } from "./ProjectDataService";
import type { ProjectService } from "./ProjectService";

/** Everything needed to add a track to a project's timeline. */
export interface CreateTrackInput {
  projectId: string;
  /** Optional display name; defaults to `Track <n>` based on the current count. */
  name?: string;
  creatorId: string;
}

/** Identifies a track to remove from a project's timeline. */
export interface DeleteTrackInput {
  projectId: string;
  /** `_id` of the embedded `ProjectTrack` to remove. */
  trackId: string;
}

/**
 * Business logic for {@link ProjectTrack}s — adding and removing the embedded
 * tracks on a project's {@link ProjectData}. Mirrors {@link ProjectClipService}:
 * it depends on other services (not repositories), since a track spans the
 * project and its data. Both mutations return the updated {@link ProjectData}
 * so the API can hand back the full new track list.
 */
export class ProjectTrackService {
  constructor(
    private readonly projects: ProjectService,
    private readonly projectData: ProjectDataService,
  ) {}

  /**
   * Add a track to the project's timeline. When no name is given, auto-names it
   * `Track <n>` based on the current track count (matching the starter track's
   * naming). Creator is the signed-in user.
   */
  async create(input: CreateTrackInput): Promise<ProjectData> {
    const project = await this.projects.findById(input.projectId);
    if (!project) throw new Error(`Project not found: ${input.projectId}`);

    const projectDataId = refToId(project.projectData);
    let name = input.name?.trim();
    if (!name) {
      const data = await this.projectData.findById(projectDataId);
      name = `Track ${(data?.tracks.length ?? 0) + 1}`;
    }

    return this.projectData.addTrack(projectDataId, {
      name,
      creator: input.creatorId,
    });
  }

  /** Remove a track (and any clips on it) from the project's timeline. */
  async delete(input: DeleteTrackInput): Promise<ProjectData> {
    const project = await this.projects.findById(input.projectId);
    if (!project) throw new Error(`Project not found: ${input.projectId}`);

    return this.projectData.removeTrack(
      refToId(project.projectData),
      input.trackId,
    );
  }
}
