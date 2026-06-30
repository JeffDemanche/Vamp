import { prop, type Ref } from "@typegoose/typegoose";
import { Field, ID, Int, ObjectType, registerEnumType } from "type-graphql";
import { ProjectTrack } from "./ProjectTrack";
// `ProjectClip` is embedded on `ProjectData`, which `ProjectAudio` transitively
// imports — so import the type only and reference the model by name in `ref` to
// avoid a circular runtime import that would break eager schema building.
import type { ProjectAudio } from "./ProjectAudio";
import { User } from "./User";

/**
 * How a {@link ProjectClip} schedules its underlying audio for playback.
 * `FLAT` plays the audio once; `STACKED` re-triggers it at every loop point
 * (using the audio's `loopLength`) so looped recordings stack on themselves.
 */
export enum ClipMode {
  FLAT = "FLAT",
  STACKED = "STACKED",
}

registerEnumType(ClipMode, {
  name: "ClipMode",
  description: "How a ProjectClip schedules its underlying audio for playback.",
});

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
   * The clip's original size, in samples — set at creation and never exceeded
   * by `duration`. Clips may only be shortened, not lengthened.
   */
  @Field(() => Int)
  @prop({ required: true })
  maxDuration!: number;

  /**
   * How this clip schedules its underlying audio. `FLAT` plays once;
   * `STACKED` re-triggers at every loop point (see `ProjectAudio.loopLength`).
   */
  @Field(() => ClipMode)
  @prop({ required: true, enum: ClipMode, default: ClipMode.FLAT })
  mode!: ClipMode;

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

  /**
   * Whether this clip has been archived (soft-removed) from the timeline.
   * Archived clips are retained on `ProjectData.clips` (so the underlying take
   * is never lost) but filtered out of the `clips` exposed through the API, so
   * they no longer render on the timeline. Internal flag — stored only, with no
   * `@Field`, mirroring how `Project.archived` hides a project without deleting
   * it.
   */
  @prop({ required: true, default: false })
  archived!: boolean;

  @Field()
  @prop({ default: () => new Date() })
  createdAt!: Date;
}
