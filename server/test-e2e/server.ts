import "reflect-metadata";
import type { Server } from "http";
import { MongoMemoryServer } from "mongodb-memory-server";

/**
 * Default port for the e2e stack. Deliberately distinct from the dev server
 * (4000) so the two never collide. Playwright passes a matching `PORT`, but this
 * default keeps the stack self-consistent if launched directly (e.g.
 * `npm run test:e2e:stack`) — see `app/playwright.config.ts` (`E2E_PORT`).
 */
const E2E_DEFAULT_HOST = "127.0.0.1";
const E2E_DEFAULT_PORT = "4001";

/**
 * Boots the real Express + Apollo stack for Playwright integration tests:
 * ephemeral in-memory MongoDB, local audio storage, and the built SPA served
 * same-origin so session cookies work without CORS.
 *
 * This entrypoint owns all the e2e env defaults so the stack binds the same port
 * and behaves identically whether Playwright launches it or it's run by hand.
 * Anything the caller already set (e.g. Playwright's `webServer.env`) wins via
 * `??=`. `MONGODB_URI` is always overridden to point at the ephemeral server,
 * and server modules are dynamically imported only once it's known.
 */
async function bootstrap(): Promise<void> {
  process.env.PORT ??= E2E_DEFAULT_PORT;
  process.env.HOST ??= E2E_DEFAULT_HOST;
  process.env.NODE_ENV ??= "test";
  process.env.E2E ??= "1";
  process.env.SERVE_CLIENT ??= "true";
  process.env.AUDIO_STORAGE_DRIVER ??= "local";
  process.env.AUDIO_LOCAL_DIR ??= ".audio-uploads-e2e";
  process.env.PUBLIC_BASE_URL ??=
    `http://${process.env.HOST}:${process.env.PORT}`;

  const mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();

  const { connectToDatabase, disconnectFromDatabase } = await import("../src/db");
  const { createApolloServer, createApp } = await import("../src/server");
  const { config } = await import("../src/config");

  await connectToDatabase(mongo.getUri());

  const apollo = await createApolloServer();
  const app = await createApp(apollo);

  const host = process.env.HOST ?? E2E_DEFAULT_HOST;
  const httpServer: Server = app.listen(config.port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`e2e backend ready at http://${host}:${config.port}`);
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
