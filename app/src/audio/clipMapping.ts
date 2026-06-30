import type { AudioEngineClip } from "./AudioEngine";

/** Minimal `ProjectAudio` shape needed to load bytes into the engine. */
export type LoadableProjectAudio = {
  _id: string;
  uploadStatus: string;
  downloadUrl?: string | null;
};

/** Minimal `ProjectClip` shape needed to derive engine clips. */
export type LoadableProjectClip = {
  _id: string;
  start: number;
  duration: number;
  audioOffset: number;
  audio?: LoadableProjectAudio | null;
};

/**
 * Map a hydrated `ProjectClip` into the shape the {@link AudioEngine} schedules
 * from. Returns `null` when the clip has no audio or the upload is not `READY`
 * yet (no bytes to play).
 */
export function toAudioEngineClip(
  clip: LoadableProjectClip,
): AudioEngineClip | null {
  const audio = clip.audio;
  if (!audio || audio.uploadStatus !== "READY") return null;
  return {
    id: clip._id,
    audioId: audio._id,
    start: clip.start,
    duration: clip.duration,
    offset: clip.audioOffset,
  };
}

/**
 * The `READY` audios from a project's `audios` list — the ones with bytes
 * available to download into the engine. Pending uploads are skipped.
 */
export function filterReadyAudios(
  audios: readonly LoadableProjectAudio[],
): LoadableProjectAudio[] {
  return audios.filter((audio) => audio.uploadStatus === "READY");
}
