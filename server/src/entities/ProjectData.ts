import { getModelForClass, prop } from "@typegoose/typegoose";
import { Field, ID, ObjectType } from "type-graphql";

/**
 * The actual editable content of a {@link Project} (tracks, regions, audio,
 * etc.). Split out from `Project` so the lightweight project metadata can be
 * listed without loading potentially large content payloads. Empty for now —
 * fields will be added as the editor takes shape.
 */
@ObjectType()
export class ProjectData {
  @Field(() => ID)
  readonly _id!: string;

  @Field()
  @prop({ default: () => new Date() })
  createdAt!: Date;
}

export const ProjectDataModel = getModelForClass(ProjectData);
