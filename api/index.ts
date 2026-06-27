import "reflect-metadata";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { config } from "@vamp/server/dist/config";
import { connectToDatabase } from "@vamp/server/dist/db";
import { createApolloServer, createApp } from "@vamp/server/dist/server";

/**
 * Vercel serverless entrypoint. The whole Vamp app — GraphQL API, audio
 * transfer routes, and the built React SPA — is one Express app; this function
 * adapts it to Vercel's request/response model.
 *
 * Building the schema, starting Apollo, and connecting to MongoDB are
 * expensive, so we do them once and cache the resulting Express app across warm
 * invocations of the same lambda instance.
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
