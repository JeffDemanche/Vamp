import type { ProjectUser } from "../entities/ProjectUser";
import type {
  ProjectUserRepository,
  ProjectUserStateData,
} from "../repositories/ProjectUserRepository";

/**
 * Business logic for {@link ProjectUser} — a user's per-project editor state.
 * Depends on the repository layer, never on the Typegoose model directly.
 */
export class ProjectUserService {
  constructor(private readonly projectUsers: ProjectUserRepository) {}

  /** A membership by its id, or `null` if it does not exist. */
  findById(id: string): Promise<ProjectUser | null> {
    return this.projectUsers.findById(id);
  }

  /** The memberships for the given ids, in arbitrary order. */
  findByIds(ids: string[]): Promise<ProjectUser[]> {
    return this.projectUsers.findByIds(ids);
  }

  /** The ids of every membership belonging to a user, across all projects. */
  findIdsByUser(userId: string): Promise<string[]> {
    return this.projectUsers.findIdsByUser(userId);
  }

  /** The given user's per-project state, or `null` if none has been saved yet. */
  findByProjectAndUser(
    projectId: string,
    userId: string,
  ): Promise<ProjectUser | null> {
    return this.projectUsers.findByProjectAndUser(projectId, userId);
  }

  /**
   * Ensure a `(project, user)` membership exists, creating it with default view
   * state if needed, and return it. Used when provisioning a project's owner and
   * contributors. Idempotent.
   */
  ensureMembership(projectId: string, userId: string): Promise<ProjectUser> {
    return this.projectUsers.upsertState(projectId, userId, {});
  }

  /** Persist (a subset of) a user's editor view state on a project, creating it if needed. */
  updateState(
    projectId: string,
    userId: string,
    data: ProjectUserStateData,
  ): Promise<ProjectUser> {
    return this.projectUsers.upsertState(projectId, userId, data);
  }
}
