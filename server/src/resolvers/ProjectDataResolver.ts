import { Ctx, FieldResolver, Resolver, Root } from "type-graphql";
import type { ServerContext } from "../context";
import { ProjectAudio } from "../entities/ProjectAudio";
import { ProjectClip } from "../entities/ProjectClip";
import { ProjectData } from "../entities/ProjectData";
import { refToId } from "../lib/ref";

/**
 * Field resolvers for {@link ProjectData}. `audios` loads every
 * {@link ProjectAudio} belonging to the owning project (via the stored
 * `project` back-reference), letting the client fetch all of a project's audio
 * in one place rather than walking the timeline's clips. `clips` exposes the
 * timeline's clips with archived ones filtered out (they remain in storage).
 */
@Resolver(() => ProjectData)
export class ProjectDataResolver {
  /**
   * The clips currently placed on the timeline — every stored clip minus those
   * that have been archived (soft-removed). Archived clips stay on the stored
   * `clips` array so the underlying take is retained; they are simply hidden
   * from the API.
   */
  @FieldResolver(() => [ProjectClip])
  clips(@Root() projectData: ProjectData): ProjectClip[] {
    return (projectData.clips ?? []).filter((clip) => !clip.archived);
  }

  /** All audio assets belonging to this project. */
  @FieldResolver(() => [ProjectAudio])
  async audios(
    @Root() projectData: ProjectData,
    @Ctx() ctx: ServerContext,
  ): Promise<ProjectAudio[]> {
    return ctx.services.projectAudios.findByProject(refToId(projectData.project));
  }
}
