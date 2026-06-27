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

export interface AppConfig {
  port: number;
  mongoUri: string;
  s3: S3Config;
}

const s3Endpoint = process.env.AWS_ENDPOINT_URL;

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/vamp",
  s3: {
    region: process.env.AWS_REGION ?? "us-east-1",
    bucket: process.env.S3_BUCKET ?? "vamp-uploads",
    endpoint: s3Endpoint,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    forcePathStyle: Boolean(s3Endpoint),
  },
};
