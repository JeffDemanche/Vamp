import "reflect-metadata";
import express from "express";
import { config } from "@vamp/server/dist/config";
import { connectToDatabase } from "@vamp/server/dist/db";
import { createApolloServer, createApp } from "@vamp/server/dist/server";

/**
 * Vercel zero-config Express entrypoint. Must live at the repo root (not in the
 * `server/` workspace) and default-export the Express app so Vercel's builder
 * can find it. The `express` import is required for entrypoint detection.
 */
await connectToDatabase(config.mongoUri);
const apollo = await createApolloServer();
const app = await createApp(apollo);

// Keep the import referenced so bundlers don't drop it.
void express;

export default app;
