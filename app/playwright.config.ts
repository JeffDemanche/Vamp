import { defineConfig, devices } from "@playwright/test";

/** Distinct from the dev server (:4000). Use 127.0.0.1 — not `localhost` — so Node
 *  doesn't resolve to ::1 while the e2e server listens on IPv4 only. */
const E2E_HOST = "127.0.0.1";
const E2E_PORT = 4001;
const E2E_ORIGIN = `http://${E2E_HOST}:${E2E_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // One shared ephemeral backend — tests must not run in parallel.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: E2E_ORIGIN,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Builds the client, then boots the real API + SPA on a single origin backed
  // by an ephemeral in-memory MongoDB (see server/test-e2e/server.ts, which owns
  // the rest of the e2e env defaults). We only pass PORT so the server binds the
  // exact port Playwright targets below.
  webServer: {
    command: "npm run test:e2e:stack",
    cwd: "..",
    url: `${E2E_ORIGIN}/health`,
    // Always boot a fresh stack so we never accidentally reuse the dev Docker
    // server (:4000) or a stale build with the wrong VITE_GRAPHQL_URI baked in.
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      PORT: String(E2E_PORT),
      HOST: E2E_HOST,
    },
  },
});
