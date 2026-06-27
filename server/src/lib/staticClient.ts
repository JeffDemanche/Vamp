import { existsSync } from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import { config } from "../config";

/** Request path prefixes owned by the API; never handed to the SPA fallback. */
const API_PREFIXES = ["/graphql", "/audio", "/health"];

/**
 * Resolve the directory containing the built SPA (`index.html` + assets).
 *
 * The build lives at `app/dist` in the repo, but the absolute path differs
 * between a plain `node` run (cwd = server/), a compiled run, and a bundled
 * serverless function (cwd = project root, with the build copied alongside).
 * Try the likely locations and pick the first that actually contains the build.
 */
function resolveClientDir(): string | null {
  const candidates = [
    config.client.distDir,
    path.resolve(process.cwd(), "app/dist"),
    path.resolve(process.cwd(), "../app/dist"),
    path.resolve(__dirname, "../../../app/dist"),
  ].filter((dir): dir is string => Boolean(dir));

  return (
    candidates.find((dir) => existsSync(path.join(dir, "index.html"))) ?? null
  );
}

/**
 * Serve the built React SPA from this Express app: static assets first, then an
 * `index.html` fallback for client-side routes. API routes (`/graphql`,
 * `/audio/*`, `/health`) are mounted earlier and excluded from the fallback.
 *
 * No-op when client serving is disabled (development) or the build is missing.
 */
export function mountClient(app: Express): void {
  if (!config.client.serve) return;

  const dir = resolveClientDir();
  if (!dir) {
    // eslint-disable-next-line no-console
    console.warn(
      "[client] SERVE_CLIENT is enabled but no build was found (looked for app/dist/index.html); skipping SPA serving.",
    );
    return;
  }

  const indexHtml = path.join(dir, "index.html");

  // Hashed assets, fonts, etc. Let unmatched requests fall through to the SPA
  // fallback rather than 404ing on deep links.
  app.use(express.static(dir, { index: false }));

  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (API_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
      return next();
    }
    res.sendFile(indexHtml);
  });
}
