import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  ID,
  InputType,
  Int,
  Mutation,
  Resolver,
  Root,
} from "type-graphql";
import type { ServerContext } from "../context";
import { ProjectAudio } from "../entities/ProjectAudio";
import { ProjectClip } from "../entities/ProjectClip";
import { ProjectData } from "../entities/ProjectData";
import { refToId } from "../lib/ref";

@InputType()
export class CreateClipInput {
  @Field(() => ID)
  projectId!: string;

  /** `_id` of the `ProjectTrack` the clip lives on. */
  @Field(() => ID)
  trackId!: string;

  /** `_id` of the (already-uploaded) `ProjectAudio` the clip plays. */
  @Field(() => ID)
  audioId!: string;

  /** Timeline start position, in samples. */
  @Field(() => Int)
  start!: number;

  /** Clip length, in samples. */
  @Field(() => Int)
  duration!: number;

  /** Offset into the underlying audio to begin at, in samples. Defaults to 0. */
  @Field(() => Int, { defaultValue: 0 })
  audioOffset!: number;
}

@InputType()
export class ArchiveClipsInput {
  @Field(() => ID)
  projectId!: string;

  /** `_id`s of the `ProjectClip`s to archive (soft-remove) from the timeline. */
  @Field(() => [ID])
  clipIds!: string[];
}

/**
 * API for {@link ProjectClip}. `createClip` links an uploaded
 * {@link ProjectAudio} to a position on the project's timeline (confirming the
 * upload completed in the process), and `archiveClips` soft-removes one or more
 * clips from the timeline. The `audio` field resolver hydrates the referenced
 * audio, which is stored only as a ref on the embedded clip.
 */
@Resolver(() => ProjectClip)
export class ProjectClipResolver {
  /**
   * Place a clip on a project's timeline, referencing audio uploaded via
   * `createAudioUpload`. Creator is the signed-in user.
   */
  @Mutation(() => ProjectClip)
  async createClip(
    @Arg("input") input: CreateClipInput,
    @Ctx() ctx: ServerContext,
  ): Promise<ProjectClip> {
    const creatorId = requireUserId(ctx);
    return ctx.services.projectClips.create({
      projectId: input.projectId,
      trackId: input.trackId,
      audioId: input.audioId,
      start: input.start,
      duration: input.duration,
      audioOffset: input.audioOffset,
      creatorId,
    });
  }

  /**
   * Archive (soft-remove) one or more clips from a project's timeline. Returns
   * the updated {@link ProjectData} (with its archived clips already filtered
   * out of `clips`) so the client refreshes its timeline from a single
   * normalized cache entry, mirroring `deleteTrack`.
   */
  @Mutation(() => ProjectData)
  async archiveClips(
    @Arg("input") input: ArchiveClipsInput,
    @Ctx() ctx: ServerContext,
  ): Promise<ProjectData> {
    requireUserId(ctx);
    return ctx.services.projectClips.archive({
      projectId: input.projectId,
      clipIds: input.clipIds,
    });
  }

  /** The {@link ProjectAudio} this clip plays. */
  @FieldResolver(() => ProjectAudio)
  async audio(
    @Root() clip: ProjectClip,
    @Ctx() ctx: ServerContext,
  ): Promise<ProjectAudio> {
    const audio = await ctx.services.projectAudios.findById(refToId(clip.audio));
    if (!audio) {
      throw new Error(`ProjectAudio not found for clip ${clip._id}`);
    }
    return audio;
  }
}

/** Resolve the signed-in user's id, throwing if the request is unauthenticated. */
function requireUserId(ctx: ServerContext): string {
  const id = ctx.currentUser?._id;
  if (!id) throw new Error("Not authenticated");
  return String(id);
}
