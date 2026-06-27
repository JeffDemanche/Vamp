import { prop, type Ref } from "@typegoose/typegoose";
import { Field, ID, Int, ObjectType } from "type-graphql";
import { ProjectTrack } from "./ProjectTrack";
import { User } from "./User";

/**
 * A clip placed on a {@link ProjectTrack} within a {@link ProjectData} timeline.
 * Clips are **embedded** subdocuments stored in `ProjectData.clips`. `track`
 * references the `_id` of the {@link ProjectTrack} (also embedded on the same
 * `ProjectData`) that the clip lives on.
 *
 * `start` and `duration` are integers measured in **samples** (not seconds) —
 * see the timeline-timestamp convention in `AGENTS.md`.
 *
 * Following the codebase convention, the `creator` relation is persisted as a
 * `Ref<User>` with no `@Field` — it is hydrated through a field resolver when
 * needed, keeping the stored shape (id) decoupled from the API shape.
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

  @Field(() => ID)
  @prop({ required: true })
  track!: string;

  @prop({ ref: () => User, required: true })
  creator!: Ref<User>;

  @Field()
  @prop({ default: () => new Date() })
  createdAt!: Date;
}
