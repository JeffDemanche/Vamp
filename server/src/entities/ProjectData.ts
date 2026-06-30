import { getModelForClass, prop, PropType, type Ref } from "@typegoose/typegoose";
import { Field, ID, ObjectType } from "type-graphql";
// `Project` references `ProjectData` at runtime, so import the type only and
// reference the model by name in `ref` to avoid a circular runtime import that
// would break eager schema building.
import type { Project } from "./Project";
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

  /**
   * Back-reference to the owning {@link Project}. Stored only (no `@Field`,
   * following the codebase convention for `Ref`s); used by the `audios` field
   * resolver to load every {@link ProjectAudio} belonging to the project
   * without walking the timeline's clips.
   */
  @prop({ ref: "Project", required: true })
  project!: Ref<Project>;

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
