import {
  ProjectUser,
  ProjectUserModel,
  ProjectUserRecording,
} from "../entities/ProjectUser";

/**
 * The persistable {@link ProjectUser} editor-view fields. Every field is
 * optional so callers can persist just the values that changed; omitted fields
 * (`undefined`) are left untouched (and fall back to schema defaults on first
 * insert). Nullable fields (`selectedTrack`/`recording`) accept `null`
 * explicitly to *clear* them (e.g. deselecting a track, stopping a recording).
 * New persisted view-state fields slot in here without touching the upsert
 * logic.
 */
export interface ProjectUserStateData {
  playStart?: number;
  playEnd?: number;
  loop?: boolean;
  viewportStart?: number;
  viewportEnd?: number;
  selectedTrack?: string | null;
  recording?: ProjectUserRecording | null;
}

/** The mutable fields, used to project `data` into a Mongo `$set`. */
const STATE_FIELDS = [
  "playStart",
  "playEnd",
  "loop",
  "viewportStart",
  "viewportEnd",
  "selectedTrack",
  "recording",
] as const;

/**
 * Data-access layer for {@link ProjectUser}. The only place that touches the
 * Typegoose model directly.
 */
export class ProjectUserRepository {
  findById(id: string): Promise<ProjectUser | null> {
    return ProjectUserModel.findById(id).lean<ProjectUser>().exec();
  }

  findByIds(ids: string[]): Promise<ProjectUser[]> {
    return ProjectUserModel.find({ _id: { $in: ids } })
      .lean<ProjectUser[]>()
      .exec();
  }

  findByProjectAndUser(
    projectId: string,
    userId: string,
  ): Promise<ProjectUser | null> {
    return ProjectUserModel.findOne({ project: projectId, user: userId })
      .lean<ProjectUser>()
      .exec();
  }

  /** The ids of every membership record belonging to a user, across projects. */
  async findIdsByUser(userId: string): Promise<string[]> {
    const docs = await ProjectUserModel.find({ user: userId })
      .select("_id")
      .lean<Pick<ProjectUser, "_id">[]>()
      .exec();
    return docs.map((doc) => String(doc._id));
  }

  /**
   * Create or update a `(project, user)` pair's editor view state, returning the
   * resulting document. Only the provided fields are written; the upsert creates
   * the row (with defaults for anything omitted) on the first save.
   */
  async upsertState(
    projectId: string,
    userId: string,
    data: ProjectUserStateData,
  ): Promise<ProjectUser> {
    const $set: Partial<
      Record<
        (typeof STATE_FIELDS)[number],
        number | boolean | string | ProjectUserRecording | null
      >
    > = {};
    for (const field of STATE_FIELDS) {
      const value = data[field];
      // `undefined` leaves the field untouched; an explicit `null` clears it.
      if (value !== undefined) $set[field] = value;
    }

    const doc = await ProjectUserModel.findOneAndUpdate(
      { project: projectId, user: userId },
      { $set, $setOnInsert: { project: projectId, user: userId } },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
    )
      .lean<ProjectUser>()
      .exec();
    if (!doc) throw new Error("Failed to upsert ProjectUser");
    return doc;
  }
}
