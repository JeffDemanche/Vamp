import "reflect-metadata";
import type { Server } from "http";
import { MongoMemoryServer } from "mongodb-memory-server";

/**
 * Boots the real Express + Apollo stack for Playwright integration tests:
 * ephemeral in-memory MongoDB, local audio storage, and the built SPA served
 * same-origin so session cookies work without CORS.
 *
 * Env vars (`SERVE_CLIENT`, `E2E`, `PORT`, `AUDIO_*`, …) must be set by the
 * parent process (Playwright `webServer.env`) before this file is loaded.
 * `MONGODB_URI` is injected here after the in-memory server starts, so server
 * modules are dynamically imported only once the URI is known.
 */
async function bootstrap(): Promise<void> {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();

  const { connectToDatabase, disconnectFromDatabase } = await import("../src/db");
  const { createApolloServer, createApp } = await import("../src/server");
  const { config } = await import("../src/config");

  await connectToDatabase(mongo.getUri());

  const apollo = await createApolloServer();
  const app = await createApp(apollo);

  const httpServer: Server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`e2e backend ready at http://localhost:${config.port}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log(`\n${signal} received, shutting down e2e server...`);
    httpServer.close();
    await apollo.stop();
    await disconnectFromDatabase();
    await mongo.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start e2e server", error);
  process.exit(1);
});
