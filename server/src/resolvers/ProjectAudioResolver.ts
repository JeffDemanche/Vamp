import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  ID,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import type { ServerContext } from "../context";
import { ProjectAudio } from "../entities/ProjectAudio";

@InputType()
export class CreateAudioUploadInput {
  @Field(() => ID)
  projectId!: string;

  /** MIME type of the audio being uploaded (e.g. `audio/wav`). */
  @Field()
  contentType!: string;

  /** Original filename, retained for display. Optional. */
  @Field({ nullable: true })
  filename?: string;

  /**
   * Loop length (samples) active when this take was recorded over a looping
   * transport. Optional — omit for non-looped takes and file imports.
   */
  @Field(() => Int, { nullable: true })
  loopLength?: number;
}

/**
 * The handshake that starts an audio upload: the created (pending)
 * {@link ProjectAudio} plus the presigned URL the client uploads the bytes to.
 */
@ObjectType()
export class CreateAudioUploadPayload {
  @Field(() => ProjectAudio)
  audio!: ProjectAudio;

  /** Short-lived presigned S3 URL to `PUT` the raw audio bytes to. */
  @Field()
  uploadUrl!: string;
}

/**
 * API for {@link ProjectAudio}. `createAudioUpload` begins the presigned-URL
 * upload flow (the client then `PUT`s the bytes straight to S3); the audio is
 * later linked to the timeline via `createClip`. The `downloadUrl` field
 * resolver mints a short-lived URL to fetch the bytes back.
 */
@Resolver(() => ProjectAudio)
export class ProjectAudioResolver {
  @Query(() => ProjectAudio, { nullable: true })
  async projectAudio(
    @Arg("id", () => ID) id: string,
    @Ctx() ctx: ServerContext,
  ): Promise<ProjectAudio | null> {
    return ctx.services.projectAudios.findById(id);
  }

  /**
   * Register a new audio asset for a project and return a presigned URL to
   * upload its bytes to S3. Creator is the signed-in user.
   */
  @Mutation(() => CreateAudioUploadPayload)
  async createAudioUpload(
    @Arg("input") input: CreateAudioUploadInput,
    @Ctx() ctx: ServerContext,
  ): Promise<CreateAudioUploadPayload> {
    const creatorId = requireUserId(ctx);
    return ctx.services.projectAudios.createUpload({
      projectId: input.projectId,
      creatorId,
      contentType: input.contentType,
      filename: input.filename,
      loopLength: input.loopLength ?? undefined,
    });
  }

  /** A short-lived presigned download URL, or null while still uploading. */
  @FieldResolver(() => String, { nullable: true })
  async downloadUrl(
    @Root() audio: ProjectAudio,
    @Ctx() ctx: ServerContext,
  ): Promise<string | null> {
    return ctx.services.projectAudios.createDownloadUrl(audio);
  }
}

/** Resolve the signed-in user's id, throwing if the request is unauthenticated. */
function requireUserId(ctx: ServerContext): string {
  const id = ctx.currentUser?._id;
  if (!id) throw new Error("Not authenticated");
  return String(id);
}
