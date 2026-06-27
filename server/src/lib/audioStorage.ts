import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { BlobNotFoundError, head as blobHead, put as blobPut } from "@vercel/blob";
import type { AudioStorageConfig } from "../config";
import { buildAudioDownloadUrl } from "./audioPaths";

/** Metadata about an object already stored in the audio store. */
export interface StoredObjectInfo {
  /** Size of the stored object in bytes. */
  contentLength: number;
  /** The object's stored MIME type, if the store recorded one. */
  contentType?: string;
}

/**
 * The seam between the audio domain (services/routes) and the backend that
 * holds the raw audio bytes. Modelled as an interface so the backing store can
 * be swapped (Vercel Blob in prod, local files in dev) without touching the
 * service/resolver layers — and so tests can use an in-memory fake.
 *
 * Uploads are server-proxied: the client `PUT`s bytes to a server route, which
 * calls {@link write}. {@link head} later confirms the object landed and
 * reports its size; {@link createDownloadUrl} yields a URL to fetch it back.
 */
export interface AudioStorage {
  /** Logical container the objects live in; recorded on each `ProjectAudio`. */
  readonly bucket: string;
  /** Persist uploaded bytes under `key`. Called by the server upload route. */
  write(key: string, body: Readable, contentType: string): Promise<void>;
  /** Metadata for a stored object, or `null` if it does not (yet) exist. */
  head(key: string): Promise<StoredObjectInfo | null>;
  /** A URL the client can fetch the bytes from. */
  createDownloadUrl(key: string): Promise<string>;
}

/**
 * Development driver that bypasses Vercel and stores audio as files on local
 * disk under `localDir`. Bytes are served back through the server's local
 * download route ({@link buildAudioDownloadUrl}).
 */
export class LocalAudioStorage implements AudioStorage {
  readonly bucket = "local";
  private readonly localDir: string;
  private readonly publicBaseUrl: string;

  constructor(config: Pick<AudioStorageConfig, "localDir" | "publicBaseUrl">) {
    this.localDir = config.localDir;
    this.publicBaseUrl = config.publicBaseUrl;
  }

  /** Absolute path for a key, kept within `localDir`. */
  resolvePath(key: string): string {
    return path.join(this.localDir, key);
  }

  async write(key: string, body: Readable, _contentType: string): Promise<void> {
    // The filesystem doesn't retain the MIME type; it stays on the record.
    const filePath = this.resolvePath(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await pipeline(body, createWriteStream(filePath));
  }

  async head(key: string): Promise<StoredObjectInfo | null> {
    try {
      const stats = await stat(this.resolvePath(key));
      // The filesystem doesn't retain the MIME type; the declared one on the
      // `ProjectAudio` record is preserved (see `markReady`).
      return { contentLength: stats.size };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  createDownloadUrl(key: string): Promise<string> {
    return Promise.resolve(buildAudioDownloadUrl(this.publicBaseUrl, key));
  }
}

/**
 * Production driver backed by Vercel Blob. Bytes are forwarded to `put()` from
 * the server upload route (server uploads — note Vercel Functions cap request
 * bodies at ~4.5 MB; larger files will need the client-upload flow or
 * multipart). `key` is used as the blob pathname (`addRandomSuffix: false`), so
 * `head`/download can locate the object by key alone.
 */
export class VercelBlobAudioStorage implements AudioStorage {
  readonly bucket = "vercel-blob";
  private readonly token?: string;

  constructor(config: Pick<AudioStorageConfig, "blobToken">) {
    this.token = config.blobToken;
  }

  async write(key: string, body: Readable, contentType: string): Promise<void> {
    await blobPut(key, body, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      token: this.token,
    });
  }

  async head(key: string): Promise<StoredObjectInfo | null> {
    try {
      const result = await blobHead(key, { token: this.token });
      return { contentLength: result.size, contentType: result.contentType };
    } catch (error) {
      if (error instanceof BlobNotFoundError) return null;
      throw error;
    }
  }

  async createDownloadUrl(key: string): Promise<string> {
    const result = await blobHead(key, { token: this.token });
    return result.downloadUrl;
  }
}

/** Build the audio storage backend selected by config. */
export function createAudioStorage(config: AudioStorageConfig): AudioStorage {
  if (config.driver === "vercel") return new VercelBlobAudioStorage(config);
  return new LocalAudioStorage(config);
}
