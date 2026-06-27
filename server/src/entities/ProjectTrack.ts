import { prop, type Ref } from "@typegoose/typegoose";
import { Field, ID, ObjectType } from "type-graphql";
import { User } from "./User";

/**
 * A single track within a {@link ProjectData} timeline. Tracks are **embedded**
 * subdocuments stored in `ProjectData.tracks` rather than their own collection,
 * so they load together with the project's content. Minimal for now — just a
 * name plus provenance fields (`creator`/`createdAt`). Clips reference the track
 * they live on by this document's `_id`.
 *
 * Following the codebase convention, the `creator` relation is persisted as a
 * `Ref<User>` with no `@Field` — it is hydrated through a field resolver when
 * needed, keeping the stored shape (id) decoupled from the API shape.
 */
@ObjectType()
export class ProjectTrack {
  @Field(() => ID)
  readonly _id!: string;

  @Field()
  @prop({ required: true, trim: true })
  name!: string;

  @prop({ ref: () => User, required: true })
  creator!: Ref<User>;

  @Field()
  @prop({ default: () => new Date() })
  createdAt!: Date;
}
