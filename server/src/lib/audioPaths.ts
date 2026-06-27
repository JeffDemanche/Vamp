/**
 * HTTP paths and URL builders for the server-owned audio transfer endpoints.
 * Defined in one place so the route handlers (`routes/audioRoutes.ts`), the
 * service that mints upload URLs, and the local storage driver agree on shape.
 *
 * Uploads always go through the server (the client `PUT`s bytes to
 * {@link AUDIO_UPLOAD_PATH}); the server then forwards them to the configured
 * backend. The local driver also serves downloads from {@link AUDIO_DOWNLOAD_PATH}.
 */

/** `PUT /audio/upload/:audioId` — clients upload raw bytes here. */
export const AUDIO_UPLOAD_PATH = "/audio/upload";

/** `GET /audio/blob/:key` — the local driver serves stored bytes here. */
export const AUDIO_DOWNLOAD_PATH = "/audio/blob";

/** The absolute URL a client `PUT`s an audio's bytes to. */
export function buildAudioUploadUrl(baseUrl: string, audioId: string): string {
  return `${baseUrl}${AUDIO_UPLOAD_PATH}/${encodeURIComponent(audioId)}`;
}

/** The absolute URL a client downloads a local-driver audio's bytes from. */
export function buildAudioDownloadUrl(baseUrl: string, key: string): string {
  // Keys contain slashes (`projects/<id>/audio/<id>`); keep them as path
  // segments rather than percent-encoding the whole thing.
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}${AUDIO_DOWNLOAD_PATH}/${encoded}`;
}
