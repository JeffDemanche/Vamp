import { getModelForClass, prop, PropType } from "@typegoose/typegoose";
import { Field, ID, ObjectType } from "type-graphql";
import { ProjectClip } from "./ProjectClip";
import { ProjectTrack } from "./ProjectTrack";

/**
 * The actual editable content of a {@link Project} (tracks, clips, audio,
 * etc.). Split out from `Project` so the lightweight project metadata can be
 * listed without loading potentially large content payloads. Tracks and clips
 * are stored as embedded subdocument arrays so they load together with the
 * project's content.
 */
@ObjectType()
export class ProjectData {
  @Field(() => ID)
  readonly _id!: string;

  @Field(() => [ProjectTrack])
  @prop({ type: () => ProjectTrack, default: [] }, PropType.ARRAY)
  tracks!: ProjectTrack[];

  @Field(() => [ProjectClip])
  @prop({ type: () => ProjectClip, default: [] }, PropType.ARRAY)
  clips!: ProjectClip[];

  @Field()
  @prop({ default: () => new Date() })
  createdAt!: Date;
}

export const ProjectDataModel = getModelForClass(ProjectData);
