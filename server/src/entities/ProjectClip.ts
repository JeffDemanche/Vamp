import { prop, type Ref } from "@typegoose/typegoose";
import { Field, ID, Int, ObjectType } from "type-graphql";
import { ProjectTrack } from "./ProjectTrack";
// `ProjectClip` is embedded on `ProjectData`, which `ProjectAudio` transitively
// imports — so import the type only and reference the model by name in `ref` to
// avoid a circular runtime import that would break eager schema building.
import type { ProjectAudio } from "./ProjectAudio";
import { User } from "./User";

/**
 * A clip placed on a {@link ProjectTrack} within a {@link ProjectData} timeline.
 * Clips are **embedded** subdocuments stored in `ProjectData.clips`. `track`
 * references the `_id` of the {@link ProjectTrack} (also embedded on the same
 * `ProjectData`) that the clip lives on, and `audio` references the
 * {@link ProjectAudio} (a separate collection) whose bytes the clip plays.
 *
 * `start`, `duration` and `audioOffset` are integers measured in **samples**
 * (not seconds) — see the timeline-timestamp convention in `AGENTS.md`.
 * `audioOffset` is the position **within the underlying audio** the clip begins
 * playing from, letting a clip expose only a window of a longer recording.
 *
 * Following the codebase convention, the `creator` and `audio` relations are
 * persisted as `Ref`s with no `@Field` — they are hydrated through field
 * resolvers when needed, keeping the stored shape (id) decoupled from the API
 * shape.
 */
@ObjectType()
export class ProjectClip {
  @Field(() => ID)
  readonly _id!: string;

  @Field(() => Int)
  @prop({ required: true })
  start!: number;

  @Field(() => Int)
  @prop({ required: true })
  duration!: number;

  /**
   * How many samples into the underlying {@link ProjectAudio} this clip starts
   * playing from. Defaults to `0` (the very beginning of the audio).
   */
  @Field(() => Int)
  @prop({ required: true, default: 0 })
  audioOffset!: number;

  @Field(() => ID)
  @prop({ required: true })
  track!: string;

  /** The {@link ProjectAudio} this clip plays. Hydrated via a field resolver. */
  @prop({ ref: "ProjectAudio", required: true })
  audio!: Ref<ProjectAudio>;

  @prop({ ref: () => User, required: true })
  creator!: Ref<User>;

  @Field()
  @prop({ default: () => new Date() })
  createdAt!: Date;
}
