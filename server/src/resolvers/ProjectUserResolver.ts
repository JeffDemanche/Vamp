import {
  Arg,
  Ctx,
  Field,
  ID,
  InputType,
  Int,
  Mutation,
  Query,
  Resolver,
} from "type-graphql";
import type { ServerContext } from "../context";
import { ProjectUser } from "../entities/ProjectUser";

@InputType()
export class SetProjectUserPlaybackInput {
  @Field(() => ID)
  projectId!: string;

  @Field(() => Int)
  playStart!: number;

  @Field(() => Int, { nullable: true })
  playEnd?: number | null;
}

/**
 * Reads/writes the authenticated user's per-project state ({@link ProjectUser}).
 * Identity comes from `ctx.currentUser` (the signed-in user) rather than an
 * argument — this is inherently the requesting user's own view of a project.
 */
@Resolver(() => ProjectUser)
export class ProjectUserResolver {
  /** The current user's saved state for a project, or null if none yet. */
  @Query(() => ProjectUser, { nullable: true })
  async projectUser(
    @Arg("projectId", () => ID) projectId: string,
    @Ctx() ctx: ServerContext,
  ): Promise<ProjectUser | null> {
    const userId = requireUserId(ctx);
    return ctx.services.projectUsers.findByProjectAndUser(projectId, userId);
  }

  /** Persist the current user's playback range for a project. */
  @Mutation(() => ProjectUser)
  async setProjectUserPlayback(
    @Arg("input") input: SetProjectUserPlaybackInput,
    @Ctx() ctx: ServerContext,
  ): Promise<ProjectUser> {
    const userId = requireUserId(ctx);
    return ctx.services.projectUsers.setPlayback(input.projectId, userId, {
      playStart: input.playStart,
      playEnd: input.playEnd ?? null,
    });
  }
}

/** Resolve the signed-in user's id, throwing if the request is unauthenticated. */
function requireUserId(ctx: ServerContext): string {
  const id = ctx.currentUser?._id;
  if (!id) throw new Error("Not authenticated");
  return String(id);
}
