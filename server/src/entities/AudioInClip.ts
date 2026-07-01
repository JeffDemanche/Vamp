import { prop } from "@typegoose/typegoose";
import { Field, ID, Int, ObjectType } from "type-graphql";

/**
 * One dispatched playback event belonging to a {@link ProjectClip}. Multiple
 * `AudioInClip`s may reference the same underlying {@link ProjectAudio} bytes
 * (e.g. stacked loop passes). Embedded on `ProjectClip.audioInClips`.
 *
 * `start` and `duration` are the intrinsic timeline window for this event;
 * the parent clip's trim envelope may cut it short at playback time (see
 * `resolveScheduledEvent` in `@vamp/shared`).
 */
@ObjectType()
export class AudioInClip {
  @Field(() => ID)
  readonly _id!: string;

  @Field(() => Int)
  @prop({ required: true })
  start!: number;

  @Field(() => Int)
  @prop({ required: true })
  duration!: number;

  /** Offset into the parent clip's {@link ProjectAudio}, in samples. */
  @Field(() => Int)
  @prop({ required: true })
  audioOffset!: number;
}
