import { ProjectUser, ProjectUserModel } from "../entities/ProjectUser";

/** The playback range to persist on a {@link ProjectUser}. */
export interface SetProjectUserPlaybackData {
  playStart: number;
  playEnd: number | null;
}

/**
 * Data-access layer for {@link ProjectUser}. The only place that touches the
 * Typegoose model directly.
 */
export class ProjectUserRepository {
  findByProjectAndUser(
    projectId: string,
    userId: string,
  ): Promise<ProjectUser | null> {
    return ProjectUserModel.findOne({ project: projectId, user: userId })
      .lean<ProjectUser>()
      .exec();
  }

  /**
   * Create or update the playback range for a `(project, user)` pair, returning
   * the resulting document. Upserts so the first save for a project transparently
   * creates the row.
   */
  async upsertPlayback(
    projectId: string,
    userId: string,
    data: SetProjectUserPlaybackData,
  ): Promise<ProjectUser> {
    const doc = await ProjectUserModel.findOneAndUpdate(
      { project: projectId, user: userId },
      {
        $set: { playStart: data.playStart, playEnd: data.playEnd },
        $setOnInsert: { project: projectId, user: userId },
      },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
    )
      .lean<ProjectUser>()
      .exec();
    if (!doc) throw new Error("Failed to upsert ProjectUser");
    return doc;
  }
}
