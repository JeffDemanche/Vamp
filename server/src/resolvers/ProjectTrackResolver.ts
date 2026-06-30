import {
  Arg,
  Ctx,
  Field,
  ID,
  InputType,
  Mutation,
  Resolver,
} from "type-graphql";
import type { ServerContext } from "../context";
import { ProjectData } from "../entities/ProjectData";
import { ProjectTrack } from "../entities/ProjectTrack";

@InputType()
export class CreateTrackInput {
  @Field(() => ID)
  projectId!: string;

  /** Optional track name; the server auto-names it `Track <n>` when omitted. */
  @Field({ nullable: true })
  name?: string;
}

@InputType()
export class DeleteTrackInput {
  @Field(() => ID)
  projectId!: string;

  /** `_id` of the embedded `ProjectTrack` to remove. */
  @Field(() => ID)
  trackId!: string;
}

/**
 * API for {@link ProjectTrack}. `createTrack` appends a new embedded track to a
 * project's timeline and `deleteTrack` removes one (along with any clips on it).
 * Both return the updated {@link ProjectData} so the client can refresh its full
 * track list from a single normalized cache entry.
 */
@Resolver(() => ProjectTrack)
export class ProjectTrackResolver {
  /** Add a track to a project's timeline. Creator is the signed-in user. */
  @Mutation(() => ProjectData)
  async createTrack(
    @Arg("input") input: CreateTrackInput,
    @Ctx() ctx: ServerContext,
  ): Promise<ProjectData> {
    const creatorId = requireUserId(ctx);
    return ctx.services.projectTracks.create({
      projectId: input.projectId,
      name: input.name,
      creatorId,
    });
  }

  /** Remove a track (and any clips on it) from a project's timeline. */
  @Mutation(() => ProjectData)
  async deleteTrack(
    @Arg("input") input: DeleteTrackInput,
    @Ctx() ctx: ServerContext,
  ): Promise<ProjectData> {
    requireUserId(ctx);
    return ctx.services.projectTracks.delete({
      projectId: input.projectId,
      trackId: input.trackId,
    });
  }
}

/** Resolve the signed-in user's id, throwing if the request is unauthenticated. */
function requireUserId(ctx: ServerContext): string {
  const id = ctx.currentUser?._id;
  if (!id) throw new Error("Not authenticated");
  return String(id);
}
