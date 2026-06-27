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

export interface AppConfig {
  port: number;
  mongoUri: string;
  nodeEnv: string;
  auth: AuthConfig;
  audio: AudioStorageConfig;
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const port = Number(process.env.PORT ?? 4000);

export const config: AppConfig = {
  port,
  mongoUri: process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/vamp",
  nodeEnv,
  auth: {
    cookieName: process.env.SESSION_COOKIE_NAME ?? "vamp_session",
    cookieSecure: nodeEnv === "production",
    sessionTtlMs:
      Number(process.env.SESSION_TTL_DAYS ?? 30) * 24 * 60 * 60 * 1000,
  },
  audio: {
    driver: process.env.AUDIO_STORAGE_DRIVER === "vercel" ? "vercel" : "local",
    publicBaseUrl:
      process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") ?? `http://localhost:${port}`,
    localDir: process.env.AUDIO_LOCAL_DIR ?? ".audio-uploads",
    blobToken: process.env.BLOB_READ_WRITE_TOKEN,
  },
};
