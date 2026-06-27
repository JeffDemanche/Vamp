import type { ProjectUser } from "../entities/ProjectUser";
import type {
  ProjectUserRepository,
  SetProjectUserPlaybackData,
} from "../repositories/ProjectUserRepository";

/**
 * Business logic for {@link ProjectUser} — a user's per-project editor state.
 * Depends on the repository layer, never on the Typegoose model directly.
 */
export class ProjectUserService {
  constructor(private readonly projectUsers: ProjectUserRepository) {}

  /** The given user's per-project state, or `null` if none has been saved yet. */
  findByProjectAndUser(
    projectId: string,
    userId: string,
  ): Promise<ProjectUser | null> {
    return this.projectUsers.findByProjectAndUser(projectId, userId);
  }

  /** Persist the playback range for a user on a project, creating it if needed. */
  setPlayback(
    projectId: string,
    userId: string,
    data: SetProjectUserPlaybackData,
  ): Promise<ProjectUser> {
    return this.projectUsers.upsertPlayback(projectId, userId, data);
  }
}
