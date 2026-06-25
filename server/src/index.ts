import "reflect-metadata";
import type { Server } from "http";
import { config } from "./config";
import { connectToDatabase, disconnectFromDatabase } from "./db";
import { createApolloServer, createApp } from "./server";

async function bootstrap(): Promise<void> {
  await connectToDatabase(config.mongoUri);

  const apollo = await createApolloServer();
  const app = await createApp(apollo);

  const httpServer: Server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`🚀 Server ready at http://localhost:${config.port}/graphql`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log(`\n${signal} received, shutting down...`);
    httpServer.close();
    await apollo.stop();
    await disconnectFromDatabase();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server", error);
  process.exit(1);
});
