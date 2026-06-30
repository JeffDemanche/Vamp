import type { AudioEngine, AudioId } from "./AudioEngine";
import type { LoadableProjectAudio } from "./clipMapping";

/** In-flight downloads keyed by audio id so concurrent callers share one fetch. */
const inFlight = new Map<AudioId, Promise<void>>();

/**
 * Fetch a `READY` {@link ProjectAudio}'s bytes from its `downloadUrl` (minted
 * by the server — local dev serves from `GET /audio/blob/...`, production from
 * Vercel Blob) and decode them into the engine's in-memory store under the
 * audio's `_id`. No-ops when the audio is not `READY`, has no URL, or is
 * already loaded. Concurrent calls for the same id share a single request.
 */
export async function ensureAudioLoaded(
  engine: AudioEngine,
  audio: LoadableProjectAudio,
): Promise<void> {
  if (audio.uploadStatus !== "READY") return;
  if (!audio.downloadUrl) return;
  if (engine.hasAudio(audio._id)) return;

  const existing = inFlight.get(audio._id);
  if (existing) return existing;

  const promise = fetchAndDecode(engine, audio._id, audio.downloadUrl);
  inFlight.set(audio._id, promise);
  try {
    await promise;
  } finally {
    inFlight.delete(audio._id);
  }
}

async function fetchAndDecode(
  engine: AudioEngine,
  id: AudioId,
  url: string,
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio ${id} (${response.status})`);
  }
  const data = await response.arrayBuffer();
  await engine.loadAudio(id, data);
}

/** Clear the in-flight download map — for tests only. */
export function resetAudioLoaderForTests(): void {
  inFlight.clear();
}
