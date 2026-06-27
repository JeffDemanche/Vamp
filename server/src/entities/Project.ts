import { getModelForClass, prop, PropType, type Ref } from "@typegoose/typegoose";
import { Types } from "mongoose";
import { Field, ID, ObjectType } from "type-graphql";
import { ProjectData } from "./ProjectData";
import { User } from "./User";

/**
 * A music project owned by one {@link User} and optionally worked on by a set
 * of contributors. The relational fields (`owner`, `contributors`,
 * `projectData`) are persisted as references and intentionally have no
 * `@Field` decorator — they are exposed to GraphQL via `@FieldResolver`s on
 * `ProjectResolver`, which load the related documents through the service
 * layer. This keeps the stored shape (ids) decoupled from the API shape
 * (hydrated objects).
 */
@ObjectType()
export class Project {
  @Field(() => ID)
  readonly _id!: string;

  @Field()
  @prop({ required: true, trim: true })
  title!: string;

  @prop({ ref: () => User, required: true })
  owner!: Ref<User>;

  @prop({ ref: () => User, type: () => Types.ObjectId, default: [] }, PropType.ARRAY)
  contributors!: Ref<User>[];

  @prop({ ref: () => ProjectData, required: true })
  projectData!: Ref<ProjectData>;

  @Field()
  @prop({ default: false })
  archived!: boolean;

  @Field()
  @prop({ default: () => new Date() })
  createdAt!: Date;
}

export const ProjectModel = getModelForClass(Project);
