import "reflect-metadata";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { config } from "@vamp/server/dist/config";
import { connectToDatabase } from "@vamp/server/dist/db";
import { createApolloServer, createApp } from "@vamp/server/dist/server";

/**
 * Vercel serverless entrypoint. Files under `api/` are built as Vercel
 * Functions by `@vercel/node` regardless of framework detection, so this works
 * even with `"framework": null` in `vercel.json` (which we set to stop Vercel
 * from mis-detecting an Express/Vite project and failing the build).
 *
 * The whole Vamp app — GraphQL API, audio transfer routes, and the SPA
 * fallback — is one Express app. We boot it (build schema, start Apollo,
 * connect to MongoDB) once and cache the result across warm invocations, then
 * hand each request to Express. Using the `(req, res)` handler form (rather
 * than a default-exported app) lets us initialise lazily and asynchronously.
 */
type ExpressHandler = (req: VercelRequest, res: VercelResponse) => void;

let appPromise: Promise<ExpressHandler> | undefined;

async function initApp(): Promise<ExpressHandler> {
  await connectToDatabase(config.mongoUri);
  const apollo = await createApolloServer();
  const app = await createApp(apollo);
  return app as unknown as ExpressHandler;
}

function getApp(): Promise<ExpressHandler> {
  appPromise ??= initApp();
  return appPromise;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const app = await getApp();
  app(req, res);
}
