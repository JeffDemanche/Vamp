import { ApolloServer } from "@apollo/server";
import { MongoMemoryServer } from "mongodb-memory-server";
import { connectToDatabase, disconnectFromDatabase } from "../src/db";
import { createSchema } from "../src/schema";
import type { ServerContext } from "../src/server";

export interface TestStack {
  mongo: MongoMemoryServer;
  apollo: ApolloServer<ServerContext>;
}

/**
 * Boots a fully-functional, isolated copy of the stack:
 *   in-memory MongoDB  ->  Mongoose/Typegoose  ->  type-graphql resolvers  ->  Apollo
 *
 * Tests can then drive the real resolvers via `apollo.executeOperation`, with
 * nothing mocked except the database location (an ephemeral in-memory server).
 */
export async function startTestStack(): Promise<TestStack> {
  const mongo = await MongoMemoryServer.create();
  await connectToDatabase(mongo.getUri());

  const schema = await createSchema();
  const apollo = new ApolloServer<ServerContext>({ schema });
  await apollo.start();

  return { mongo, apollo };
}

export async function stopTestStack(stack: TestStack | undefined): Promise<void> {
  if (!stack) return;
  await stack.apollo.stop();
  await disconnectFromDatabase();
  await stack.mongo.stop();
}

/**
 * Run a GraphQL operation and return the single (non-incremental) result,
 * throwing if Apollo returned an incremental/streamed response shape.
 */
export async function execute<TData = Record<string, unknown>>(
  apollo: ApolloServer<ServerContext>,
  query: string,
  variables?: Record<string, unknown>,
): Promise<{ data?: TData | null; errors?: readonly { message: string }[] }> {
  const response = await apollo.executeOperation<TData>(
    { query, variables },
    { contextValue: {} },
  );

  if (response.body.kind !== "single") {
    throw new Error("Expected a single GraphQL result");
  }

  return {
    data: response.body.singleResult.data as TData | null | undefined,
    errors: response.body.singleResult.errors,
  };
}
