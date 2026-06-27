export interface S3Config {
  region: string;
  bucket: string;
  /**
   * Custom endpoint for an S3-compatible service. Set in local development to
   * point at LocalStack (e.g. `http://localstack:4566`); unset in production to
   * use real AWS S3.
   */
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  /** LocalStack requires path-style addressing; enabled when an endpoint is set. */
  forcePathStyle: boolean;
}

export interface AuthConfig {
  /** Name of the HttpOnly session cookie. */
  cookieName: string;
  /** Send the cookie only over HTTPS. Enabled outside development. */
  cookieSecure: boolean;
  /** Session lifetime in milliseconds; also used as the cookie `maxAge`. */
  sessionTtlMs: number;
}

export interface AppConfig {
  port: number;
  mongoUri: string;
  nodeEnv: string;
  auth: AuthConfig;
  s3: S3Config;
}

const s3Endpoint = process.env.AWS_ENDPOINT_URL;
const nodeEnv = process.env.NODE_ENV ?? "development";

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/vamp",
  nodeEnv,
  auth: {
    cookieName: process.env.SESSION_COOKIE_NAME ?? "vamp_session",
    cookieSecure: nodeEnv === "production",
    sessionTtlMs:
      Number(process.env.SESSION_TTL_DAYS ?? 30) * 24 * 60 * 60 * 1000,
  },
  s3: {
    region: process.env.AWS_REGION ?? "us-east-1",
    bucket: process.env.S3_BUCKET ?? "vamp-uploads",
    endpoint: s3Endpoint,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    forcePathStyle: Boolean(s3Endpoint),
  },
};
