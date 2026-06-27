import type { GraphQLSchema } from "graphql";
import { buildSchema } from "type-graphql";
import { AuthResolver } from "./resolvers/AuthResolver";
import { ProjectResolver } from "./resolvers/ProjectResolver";
import { UserResolver } from "./resolvers/UserResolver";

export interface CreateSchemaOptions {
  /** Absolute path to write the SDL to, or `false` to skip emitting. */
  emitSchemaFile?: string | false;
}

export async function createSchema(
  options: CreateSchemaOptions = {},
): Promise<GraphQLSchema> {
  return buildSchema({
    resolvers: [AuthResolver, UserResolver, ProjectResolver],
    emitSchemaFile: options.emitSchemaFile ?? false,
    validate: true,
  });
}
