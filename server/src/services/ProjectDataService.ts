import type { ProjectClip } from "../entities/ProjectClip";
import type { ProjectData } from "../entities/ProjectData";
import type {
  AddClipData,
  AddTrackData,
  ProjectDataRepository,
} from "../repositories/ProjectDataRepository";

/**
 * Business logic for {@link ProjectData}. Depends on the repository layer,
 * never on the Typegoose model directly.
 */
export class ProjectDataService {
  constructor(private readonly projectData: ProjectDataRepository) {}

  findById(id: string): Promise<ProjectData | null> {
    return this.projectData.findById(id);
  }

  /** Append a clip to a project's timeline, returning the created clip. */
  addClip(projectDataId: string, data: AddClipData): Promise<ProjectClip> {
    return this.projectData.addClip(projectDataId, data);
  }

  /**
   * Archive (soft-remove) the clips with the given ids from a project's
   * timeline, returning the updated data. Archived clips are retained in
   * storage but hidden from the exposed timeline.
   */
  archiveClips(projectDataId: string, clipIds: string[]): Promise<ProjectData> {
    return this.projectData.archiveClips(projectDataId, clipIds);
  }

  /** Append a track to a project's timeline, returning the updated data. */
  addTrack(projectDataId: string, data: AddTrackData): Promise<ProjectData> {
    return this.projectData.addTrack(projectDataId, data);
  }

  /**
   * Remove a track (and its clips) from a project's timeline, returning the
   * updated data.
   */
  removeTrack(projectDataId: string, trackId: string): Promise<ProjectData> {
    return this.projectData.removeTrack(projectDataId, trackId);
  }

  /**
   * Provision a new {@link ProjectData} for `projectId`, seeded with a single
   * starter track owned by `creatorId` (the project's creator). The owning
   * project id is stored as a back-reference so its audios can be resolved.
   */
  create(projectId: string, creatorId: string): Promise<ProjectData> {
    return this.projectData.create({
      project: projectId,
      tracks: [{ name: "Track 1", creator: creatorId }],
    });
  }
}
