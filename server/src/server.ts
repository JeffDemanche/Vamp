import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import cors from "cors";
import express, { type Express } from "express";
import { createServices } from "./container";
import type { ServerContext } from "./context";
import { createSchema } from "./schema";

export type { ServerContext } from "./context";

export async function createApolloServer(): Promise<ApolloServer<ServerContext>> {
  const schema = await createSchema();
  const apollo = new ApolloServer<ServerContext>({ schema });
  await apollo.start();
  return apollo;
}

/**
 * Build the Express app and mount the (already started) Apollo server.
 * Returning the app without listening makes it trivial to drive in tests
 * with supertest-style HTTP calls or Apollo's `executeOperation`.
 */
export async function createApp(
  apollo: ApolloServer<ServerContext>,
): Promise<Express> {
  const app = express();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(
    "/graphql",
    cors<cors.CorsRequest>(),
    express.json(),
    expressMiddleware(apollo, {
      context: async (): Promise<ServerContext> => ({
        services: createServices(),
      }),
    }),
  );

  return app;
}
