import { getModelForClass, prop, type Ref } from "@typegoose/typegoose";
import { Field, ID, Int, ObjectType, registerEnumType } from "type-graphql";
import { Project } from "./Project";
import { User } from "./User";

/**
 * Lifecycle of a {@link ProjectAudio}'s underlying S3 object. Audio is created
 * `Pending` the moment we hand out a presigned upload URL, and flips to `Ready`
 * once the server has confirmed the bytes actually landed in the bucket (via a
 * `HEAD`). A clip may only reference `Ready` audio.
 */
export enum AudioUploadStatus {
  PENDING = "PENDING",
  READY = "READY",
}

registerEnumType(AudioUploadStatus, {
  name: "AudioUploadStatus",
  description: "Upload lifecycle of a ProjectAudio's underlying S3 object.",
});

/**
 * A handle to a single audio asset belonging to a {@link Project}, stored as an
 * object in S3 (the `bucket`/`key` pair locate the raw bytes; the bytes
 * themselves never pass through the GraphQL API). Stored in its own collection —
 * not embedded — so the same upload can be referenced by clips without copying
 * the payload. One or more {@link ProjectClip}s reference a `ProjectAudio`.
 *
 * The `project`/`creator` relations are persisted as `Ref`s with no `@Field`
 * following the codebase convention (lookup keys, not part of the API shape).
 * Download access is granted through a short-lived presigned URL exposed by a
 * field resolver rather than the bare key.
 */
@ObjectType()
export class ProjectAudio {
  @Field(() => ID)
  readonly _id!: string;

  /** The project this audio belongs to. Stored only; not exposed via GraphQL. */
  @prop({ ref: () => Project, required: true })
  project!: Ref<Project>;

  /** The S3 bucket the object lives in. */
  @Field()
  @prop({ required: true })
  bucket!: string;

  /** The S3 object key locating the raw audio bytes within `bucket`. */
  @Field()
  @prop({ required: true })
  key!: string;

  /** MIME type the client declared when requesting the upload (e.g. `audio/wav`). */
  @Field()
  @prop({ required: true })
  contentType!: string;

  /**
   * Size of the stored object in bytes, captured from S3 once the upload is
   * confirmed. `null` while the audio is still `Pending`.
   */
  @Field(() => Int, { nullable: true })
  @prop()
  byteSize?: number;

  /** Original client-side filename, retained for display. Optional. */
  @Field(() => String, { nullable: true })
  @prop({ trim: true })
  filename?: string;

  /**
   * The loop length (in samples) active when this audio was recorded over a
   * looping transport. `null` for non-looped takes and file imports. Used by
   * **stacked** clips to re-trigger the audio at every loop point.
   */
  @Field(() => Int, { nullable: true })
  @prop()
  loopLength?: number;

  /** Whether the upload has been confirmed present in S3. */
  @Field(() => AudioUploadStatus)
  @prop({ required: true, enum: AudioUploadStatus, default: AudioUploadStatus.PENDING })
  uploadStatus!: AudioUploadStatus;

  @prop({ ref: () => User, required: true })
  creator!: Ref<User>;

  @Field()
  @prop({ default: () => new Date() })
  createdAt!: Date;
}

export const ProjectAudioModel = getModelForClass(ProjectAudio);
