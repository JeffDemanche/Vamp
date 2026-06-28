import { getModelForClass, index, prop, type Ref } from "@typegoose/typegoose";
import { Field, ID, Int, ObjectType } from "type-graphql";
import { Project } from "./Project";
import { User } from "./User";

/**
 * A user's **active recording** within a project — the in-flight take being
 * captured. Embedded on {@link ProjectUser} (a subdocument, no own `_id`) and
 * `null` whenever the user is not recording. Persisting it per user lets the
 * editor restore an interrupted recording and, in future, surface other
 * collaborators' live recording state.
 *
 * - `track` is the `_id` of the embedded {@link ProjectTrack} the take lands on
 *   (the user's currently `selectedTrack` at the moment recording began).
 * - `startSample` is the timeline sample the recording starts at (in **samples**
 *   — see `AGENTS.md`): the playback start when recording began from a stopped
 *   transport, or the live playhead when armed mid-playback.
 * - `startedAt` is the wall-clock instant recording began, so elapsed real time
 *   (and thus the growing recorded length) can be derived for any observer.
 */
@ObjectType()
export class ProjectUserRecording {
  /** `_id` of the embedded `ProjectTrack` the recording is being captured on. */
  @Field(() => ID)
  @prop({ required: true })
  track!: string;

  /** Timeline sample the recording starts at. */
  @Field(() => Int)
  @prop({ required: true })
  startSample!: number;

  /** Wall-clock instant the recording began. */
  @Field()
  @prop({ required: true })
  startedAt!: Date;
}

/**
 * A {@link User}'s membership in a {@link Project}: the join record that ties a
 * user to a project, also carrying that user's per-project editor "view state"
 * so it survives reloads:
 *
 * - the **playback range** (`playStart`/`playEnd`) and whether playback `loop`s;
 * - the **timeline viewport** (`viewportStart`/`viewportEnd`) — the visible span.
 *
 * `Project.owner` and `Project.contributors` reference these records (not bare
 * `User`s), so a `ProjectUser` is the canonical representation of "this user is
 * part of this project". It is **keyed by the `(project, user)` combination**,
 * enforced by a unique compound index — at most one membership per pair.
 *
 * Stored in its own collection (not embedded on `Project`/`ProjectData`). The
 * `project`/`user` relations are persisted as `Ref`s with no `@Field` following
 * the codebase convention — they are lookup keys, not part of the API shape
 * (the `user` is hydrated through a field resolver).
 *
 * All sample fields (`playStart`/`playEnd`/`viewportStart`/`viewportEnd`) are
 * integers measured in **samples** (not seconds) — see the timeline-timestamp
 * convention in `AGENTS.md`. Defaults mirror the client's timeline defaults at
 * 44.1 kHz, and only apply before the client first persists its own state.
 */
@ObjectType()
@index({ project: 1, user: 1 }, { unique: true })
export class ProjectUser {
  @Field(() => ID)
  readonly _id!: string;

  @prop({ ref: () => Project, required: true })
  project!: Ref<Project>;

  @prop({ ref: () => User, required: true })
  user!: Ref<User>;

  /** Sample at which playback begins. Always a concrete position. */
  @Field(() => Int)
  @prop({ required: true, default: 0 })
  playStart!: number;

  /**
   * Sample at which playback loops back to `playStart`. Always a concrete
   * position; it only takes effect when `loop` is `true` (otherwise playback
   * runs indefinitely). Default mirrors the client's 10s default.
   */
  @Field(() => Int)
  @prop({ required: true, default: 441_000 })
  playEnd!: number;

  /** Whether playback loops back to `playStart` upon reaching `playEnd`. */
  @Field()
  @prop({ required: true, default: false })
  loop!: boolean;

  /** Sample coordinate at the left edge of the visible timeline. May be negative. */
  @Field(() => Int)
  @prop({ required: true, default: -44_100 })
  viewportStart!: number;

  /** Sample coordinate at the right edge of the visible timeline. May be negative. */
  @Field(() => Int)
  @prop({ required: true, default: 441_000 })
  viewportEnd!: number;

  /**
   * `_id` of the embedded {@link ProjectTrack} this user has selected. New
   * recordings land on the selected track; at most one is selected at a time.
   * `null` when no track is selected.
   */
  @Field(() => ID, { nullable: true })
  @prop({ type: String })
  selectedTrack?: string | null;

  /**
   * The user's in-flight recording, or `null` when they are not recording.
   * Embedded subdocument (no own `_id`).
   */
  @Field(() => ProjectUserRecording, { nullable: true })
  @prop({ type: () => ProjectUserRecording, _id: false })
  recording?: ProjectUserRecording | null;

  @Field()
  @prop({ default: () => new Date() })
  createdAt!: Date;
}

export const ProjectUserModel = getModelForClass(ProjectUser);
