import type { CodegenConfig } from "@graphql-codegen/cli";

/**
 * Reads the SDL emitted by the server (`server/schema.graphql`) and the
 * `graphql(...)` operations declared in the app, then generates fully-typed
 * documents under `src/generated/`. This is how the client and server share
 * a single source of truth for the API contract.
 *
 * Run `npm run schema` in the server first, then `npm run codegen` here.
 */
const config: CodegenConfig = {
  schema: "../server/schema.graphql",
  documents: ["src/**/*.{ts,tsx}", "!src/generated/**/*"],
  ignoreNoDocuments: true,
  generates: {
    "src/generated/": {
      preset: "client",
      presetConfig: {
        fragmentMasking: false,
      },
    },
  },
};

export default config;
