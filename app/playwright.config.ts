import { defineConfig, devices } from "@playwright/test";

const E2E_PORT = 4001;

export default defineConfig({
  testDir: "./e2e",
  // One shared ephemeral backend — tests must not run in parallel.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Builds the client, then boots the real API + SPA on a single origin backed
  // by an ephemeral in-memory MongoDB (see server/test-e2e/server.ts).
  webServer: {
    command: "npm run test:e2e:stack",
    cwd: "..",
    url: `http://localhost:${E2E_PORT}/health`,
    // Always boot a fresh stack so we never accidentally reuse the dev Docker
    // server (:4000) or a stale build with the wrong VITE_GRAPHQL_URI baked in.
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      PORT: String(E2E_PORT),
      NODE_ENV: "test",
      SERVE_CLIENT: "true",
      AUDIO_STORAGE_DRIVER: "local",
      AUDIO_LOCAL_DIR: ".audio-uploads-e2e",
      PUBLIC_BASE_URL: `http://localhost:${E2E_PORT}`,
      E2E: "1",
      VITE_GRAPHQL_URI: "/graphql",
    },
  },
});
