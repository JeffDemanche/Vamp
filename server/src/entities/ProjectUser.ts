import { getModelForClass, index, prop, type Ref } from "@typegoose/typegoose";
import { Field, ID, Int, ObjectType } from "type-graphql";
import { Project } from "./Project";
import { User } from "./User";

/**
 * Per-user, per-project state for a {@link Project}: information that belongs to
 * one {@link User}'s view of a project rather than the shared project content.
 * For now this is just the editor's **playback range** (`playStart`/`playEnd`),
 * which the client's timeline local state persists so it survives reloads.
 *
 * Stored in its own collection (not embedded on `Project`/`ProjectData`) and
 * keyed by the `(project, user)` pair, enforced by a unique compound index. The
 * `project`/`user` relations are persisted as `Ref`s with no `@Field` following
 * the codebase convention — they are lookup keys, not part of the API shape.
 *
 * `playStart`/`playEnd` are integers measured in **samples** (not seconds) — see
 * the timeline-timestamp convention in `AGENTS.md`.
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
   * Sample at which playback ends/loops, or `null` when there is no end
   * boundary and playback runs indefinitely.
   */
  @Field(() => Int, { nullable: true })
  @prop({ type: Number, default: null })
  playEnd!: number | null;

  @Field()
  @prop({ default: () => new Date() })
  createdAt!: Date;
}

export const ProjectUserModel = getModelForClass(ProjectUser);
