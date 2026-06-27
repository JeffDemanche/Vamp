export interface AuthConfig {
  /** Name of the HttpOnly session cookie. */
  cookieName: string;
  /** Send the cookie only over HTTPS. Enabled outside development. */
  cookieSecure: boolean;
  /** Session lifetime in milliseconds; also used as the cookie `maxAge`. */
  sessionTtlMs: number;
}

/** Which backend stores the raw audio bytes. */
export type AudioStorageDriver = "vercel" | "local";

export interface AudioStorageConfig {
  /**
   * Backend for audio bytes. `vercel` uses Vercel Blob (production); `local`
   * bypasses Vercel and writes files to disk for development. Defaults to
   * `local` unless `AUDIO_STORAGE_DRIVER=vercel`.
   */
  driver: AudioStorageDriver;
  /**
   * Base URL of this server, used to build the upload endpoint (and, for the
   * local driver, download) URLs handed to the client.
   */
  publicBaseUrl: string;
  /** Directory the `local` driver writes audio files to. */
  localDir: string;
  /**
   * Read-write token for the `vercel` driver (`BLOB_READ_WRITE_TOKEN`). The
   * `@vercel/blob` SDK also reads this from the environment automatically.
   */
  blobToken?: string;
}

export interface ClientConfig {
  /**
   * Whether this server also serves the built React SPA (`app/dist`). Enabled
   * by default in production (e.g. the single Vercel deployment) and disabled
   * in development where the Vite dev server owns the client.
   */
  serve: boolean;
  /**
   * Explicit path to the client build output. When unset the server
   * auto-detects `app/dist` relative to the working directory / bundle.
   */
  distDir?: string;
}

export interface AppConfig {
  port: number;
  mongoUri: string;
  nodeEnv: string;
  auth: AuthConfig;
  audio: AudioStorageConfig;
  client: ClientConfig;
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const port = Number(process.env.PORT ?? 4000);

/**
 * Best-effort public origin of this server. Prefers an explicit
 * `PUBLIC_BASE_URL`, then Vercel's injected `VERCEL_URL` (host only, so we add
 * the scheme), and finally localhost for development.
 */
const publicBaseUrl = (
  process.env.PUBLIC_BASE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:${port}`)
).replace(/\/$/, "");

export const config: AppConfig = {
  port,
  mongoUri: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/vamp",
  nodeEnv,
  auth: {
    cookieName: process.env.SESSION_COOKIE_NAME ?? "vamp_session",
    cookieSecure: nodeEnv === "production",
    sessionTtlMs:
      Number(process.env.SESSION_TTL_DAYS ?? 30) * 24 * 60 * 60 * 1000,
  },
  audio: {
    driver: process.env.AUDIO_STORAGE_DRIVER === "vercel" ? "vercel" : "local",
    publicBaseUrl,
    localDir: process.env.AUDIO_LOCAL_DIR ?? ".audio-uploads",
    blobToken: process.env.BLOB_READ_WRITE_TOKEN,
  },
  client: {
    serve: process.env.SERVE_CLIENT
      ? process.env.SERVE_CLIENT !== "false"
      : nodeEnv === "production",
    distDir: process.env.CLIENT_DIST_DIR,
  },
};
