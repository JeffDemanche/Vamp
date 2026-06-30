import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import { config } from "./config";
import { createServices } from "./container";
import type { ServerContext } from "./context";
import { mountAudioRoutes } from "./routes/audioRoutes";
import { mountE2eRoutes } from "./routes/e2eRoutes";
import { createSchema } from "./schema";
import { mountClient } from "./lib/staticClient";

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

  // Binary audio transfer endpoints (upload/download), kept outside GraphQL.
  mountAudioRoutes(app);

  mountE2eRoutes(app);

  app.use(
    "/graphql",
    // Reflect the request origin and allow credentials so the session cookie
    // is sent on cross-origin requests from the client dev server.
    cors<cors.CorsRequest>({ origin: true, credentials: true }),
    express.json(),
    cookieParser(),
    expressMiddleware(apollo, {
      context: async ({ req, res }): Promise<ServerContext> => {
        const services = createServices();
        const token =
          (req.cookies?.[config.auth.cookieName] as string | undefined) ?? null;
        const currentUser = token
          ? await services.auth.authenticateBySessionToken(token)
          : null;
        return { services, res, currentUser, sessionToken: token };
      },
    }),
  );

  // Serve the built SPA (production / single-deployment mode). Mounted last so
  // it never shadows the API routes above.
  mountClient(app);

  return app;
}
