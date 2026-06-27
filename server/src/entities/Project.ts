import { getModelForClass, prop, PropType, type Ref } from "@typegoose/typegoose";
import { Types } from "mongoose";
import { Field, ID, ObjectType } from "type-graphql";
import { ProjectData } from "./ProjectData";
// `ProjectUser` in turn references `Project`, so import it as a type only and
// reference the model by name in `ref` to avoid a circular runtime import that
// would break eager schema building.
import type { ProjectUser } from "./ProjectUser";

/**
 * A music project owned by one user and optionally worked on by a set of
 * contributors. Membership is modelled through {@link ProjectUser}: both
 * `owner` and `contributors` reference a user's `ProjectUser` (their
 * per-project membership/view-state record) rather than the bare `User`.
 *
 * The relational fields (`owner`, `contributors`, `projectData`) are persisted
 * as references and intentionally have no `@Field` decorator — they are exposed
 * to GraphQL via `@FieldResolver`s on `ProjectResolver`, which load the related
 * documents through the service layer. This keeps the stored shape (ids)
 * decoupled from the API shape (hydrated objects).
 */
@ObjectType()
export class Project {
  @Field(() => ID)
  readonly _id!: string;

  @Field()
  @prop({ required: true, trim: true })
  title!: string;

  @prop({ ref: "ProjectUser", required: true })
  owner!: Ref<ProjectUser>;

  @prop(
    { ref: "ProjectUser", type: () => Types.ObjectId, default: [] },
    PropType.ARRAY,
  )
  contributors!: Ref<ProjectUser>[];

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
