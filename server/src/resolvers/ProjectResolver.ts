import { Types } from "mongoose";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  ID,
  InputType,
  Mutation,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import type { ServerContext } from "../context";
import { Project } from "../entities/Project";
import { ProjectData } from "../entities/ProjectData";
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
export class CreateProjectInput {
  @Field()
  title!: string;

  @Field(() => ID)
  ownerId!: string;

  @Field(() => [ID], { defaultValue: [] })
  contributorIds!: string[];
}

@InputType()
export class UpdateProjectMetadataInput {
  @Field(() => ID)
  id!: string;

  @Field({ nullable: true })
  title?: string;
}

@Resolver(() => Project)
export class ProjectResolver {
  @Query(() => Project, { nullable: true })
  async project(
    @Arg("id", () => ID) id: string,
    @Ctx() ctx: ServerContext,
  ): Promise<Project | null> {
    return ctx.services.projects.findById(id);
  }

  @Query(() => [Project])
  async projectsByUser(
    @Arg("userId", () => ID) userId: string,
    @Arg("includeArchived", () => Boolean, { defaultValue: false })
    includeArchived: boolean,
    @Ctx() ctx: ServerContext,
  ): Promise<Project[]> {
    return ctx.services.projects.findByUser(userId, includeArchived);
  }

  @Mutation(() => Project)
  async createProject(
    @Arg("input") input: CreateProjectInput,
    @Ctx() ctx: ServerContext,
  ): Promise<Project> {
    return ctx.services.projects.create({
      title: input.title,
      ownerId: input.ownerId,
      contributorIds: input.contributorIds,
    });
  }

  /** Create a new empty project with an auto-generated poetic title. */
  @Mutation(() => Project)
  async createEmptyProject(
    @Arg("ownerId", () => ID) ownerId: string,
    @Ctx() ctx: ServerContext,
  ): Promise<Project> {
    return ctx.services.projects.createEmpty(ownerId);
  }

  /** Archive or unarchive a project. */
  @Mutation(() => Project)
  async setProjectArchived(
    @Arg("id", () => ID) id: string,
    @Arg("archived") archived: boolean,
    @Ctx() ctx: ServerContext,
  ): Promise<Project> {
    return ctx.services.projects.setArchived(id, archived);
  }

  /** Update metadata stored directly on the project (e.g. its title). */
  @Mutation(() => Project)
  async updateProjectMetadata(
    @Arg("input") input: UpdateProjectMetadataInput,
    @Ctx() ctx: ServerContext,
  ): Promise<Project> {
    return ctx.services.projects.updateMetadata(input.id, {
      title: input.title,
    });
  }

  @FieldResolver(() => User)
  async owner(
    @Root() project: Project,
    @Ctx() ctx: ServerContext,
  ): Promise<User> {
    const owner = await ctx.services.users.findById(refToId(project.owner));
    if (!owner) {
      throw new Error(`Owner not found for project ${project._id}`);
    }
    return owner;
  }

  @FieldResolver(() => [User])
  async contributors(
    @Root() project: Project,
    @Ctx() ctx: ServerContext,
  ): Promise<User[]> {
    return ctx.services.users.findByIds(project.contributors.map(refToId));
  }

  @FieldResolver(() => ProjectData)
  async projectData(
    @Root() project: Project,
    @Ctx() ctx: ServerContext,
  ): Promise<ProjectData> {
    const data = await ctx.services.projectData.findById(
      refToId(project.projectData),
    );
    if (!data) {
      throw new Error(`ProjectData not found for project ${project._id}`);
    }
    return data;
  }
}
