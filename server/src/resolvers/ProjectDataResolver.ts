import { Ctx, FieldResolver, Resolver, Root } from "type-graphql";
import type { ServerContext } from "../context";
import { ProjectAudio } from "../entities/ProjectAudio";
import { ProjectData } from "../entities/ProjectData";
import { refToId } from "../lib/ref";

/**
 * Field resolvers for {@link ProjectData}. `audios` loads every
 * {@link ProjectAudio} belonging to the owning project (via the stored
 * `project` back-reference), letting the client fetch all of a project's audio
 * in one place rather than walking the timeline's clips.
 */
@Resolver(() => ProjectData)
export class ProjectDataResolver {
  /** All audio assets belonging to this project. */
  @FieldResolver(() => [ProjectAudio])
  async audios(
    @Root() projectData: ProjectData,
    @Ctx() ctx: ServerContext,
  ): Promise<ProjectAudio[]> {
    return ctx.services.projectAudios.findByProject(refToId(projectData.project));
  }
}
