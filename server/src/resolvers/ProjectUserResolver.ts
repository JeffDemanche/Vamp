import { Types } from "mongoose";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  ID,
  InputType,
  Int,
  Mutation,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import type { ServerContext } from "../context";
import { ProjectUser } from "../entities/ProjectUser";
import { User } from "../entities/User";

/**
 * Extract the string id from a Typegoose `Ref`, whether it is an unpopulated
 * `ObjectId` or an already-populated document.
 */
function refToId(ref: unknown): string {
  if (ref instanceof Types.ObjectId) return ref.toHexString();
  if (ref && typeof ref === "object" && "_id" in ref) {
    return String((ref as { _id: unknown })._id);
  }
  return String(ref);
}

@InputType()
export class ProjectUserRecordingInput {
  /** `_id` of the embedded `ProjectTrack` the recording is captured on. */
  @Field(() => ID)
  track!: string;

  /** Timeline sample the recording starts at. */
  @Field(() => Int)
  startSample!: number;

  /** Wall-clock instant the recording began. */
  @Field()
  startedAt!: Date;
}

@InputType()
export class UpdateProjectUserStateInput {
  @Field(() => ID)
  projectId!: string;

  @Field(() => Int, { nullable: true })
  playStart?: number;

  @Field(() => Int, { nullable: true })
  playEnd?: number;

  @Field({ nullable: true })
  loop?: boolean;

  @Field(() => Int, { nullable: true })
  viewportStart?: number;

  @Field(() => Int, { nullable: true })
  viewportEnd?: number;

  /**
   * `_id` of the track to select. Pass `null` to deselect. Omit to leave the
   * current selection untouched.
   */
  @Field(() => ID, { nullable: true })
  selectedTrack?: string | null;

  /**
   * The active recording, or `null` to stop/clear it. Omit to leave the current
   * recording untouched.
   */
  @Field(() => ProjectUserRecordingInput, { nullable: true })
  recording?: ProjectUserRecordingInput | null;
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

  /**
   * Persist (a subset of) the current user's editor view state for a project.
   * Only the provided fields are written, so the client can sync just what
   * changed (e.g. the viewport without touching the playback range).
   */
  @Mutation(() => ProjectUser)
  async updateProjectUserState(
    @Arg("input") input: UpdateProjectUserStateInput,
    @Ctx() ctx: ServerContext,
  ): Promise<ProjectUser> {
    const userId = requireUserId(ctx);
    return ctx.services.projectUsers.updateState(input.projectId, userId, {
      playStart: input.playStart,
      playEnd: input.playEnd,
      loop: input.loop,
      viewportStart: input.viewportStart,
      viewportEnd: input.viewportEnd,
      selectedTrack: input.selectedTrack,
      recording: input.recording,
    });
  }

  /** The {@link User} this membership belongs to. */
  @FieldResolver(() => User)
  async user(
    @Root() projectUser: ProjectUser,
    @Ctx() ctx: ServerContext,
  ): Promise<User> {
    const user = await ctx.services.users.findById(refToId(projectUser.user));
    if (!user) {
      throw new Error(`User not found for ProjectUser ${projectUser._id}`);
    }
    return user;
  }
}

/** Resolve the signed-in user's id, throwing if the request is unauthenticated. */
function requireUserId(ctx: ServerContext): string {
  const id = ctx.currentUser?._id;
  if (!id) throw new Error("Not authenticated");
  return String(id);
}
