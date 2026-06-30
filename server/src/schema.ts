import type { GraphQLSchema } from "graphql";
import { buildSchema } from "type-graphql";
import { AuthResolver } from "./resolvers/AuthResolver";
import { ProjectAudioResolver } from "./resolvers/ProjectAudioResolver";
import { ProjectClipResolver } from "./resolvers/ProjectClipResolver";
import { ProjectDataResolver } from "./resolvers/ProjectDataResolver";
import { ProjectResolver } from "./resolvers/ProjectResolver";
import { ProjectTrackResolver } from "./resolvers/ProjectTrackResolver";
import { ProjectUserResolver } from "./resolvers/ProjectUserResolver";
import { UserResolver } from "./resolvers/UserResolver";

export interface CreateSchemaOptions {
  /** Absolute path to write the SDL to, or `false` to skip emitting. */
  emitSchemaFile?: string | false;
}

export async function createSchema(
  options: CreateSchemaOptions = {},
): Promise<GraphQLSchema> {
  return buildSchema({
    resolvers: [
      AuthResolver,
      UserResolver,
      ProjectResolver,
      ProjectDataResolver,
      ProjectUserResolver,
      ProjectAudioResolver,
      ProjectClipResolver,
      ProjectTrackResolver,
    ],
    emitSchemaFile: options.emitSchemaFile ?? false,
    validate: true,
  });
}
