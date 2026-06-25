import "reflect-metadata";
import path from "path";
import { createSchema } from "./schema";

/**
 * Emits the GraphQL SDL to `server/schema.graphql`. The app's GraphQL Code
 * Generator reads this file to produce fully-typed Apollo Client hooks, so the
 * client and server share a single source of truth for the API contract.
 */
async function main(): Promise<void> {
  const schemaPath = path.resolve(__dirname, "..", "schema.graphql");
  await createSchema({ emitSchemaFile: schemaPath });
  // eslint-disable-next-line no-console
  console.log(`✅ GraphQL schema emitted to ${schemaPath}`);
  process.exit(0);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to emit schema", error);
  process.exit(1);
});
