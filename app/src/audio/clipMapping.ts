import type { AudioEngineClip, ClipSchedulingMode } from "./AudioEngine";

/** Minimal `ProjectAudio` shape needed to load bytes into the engine. */
export type LoadableProjectAudio = {
  _id: string;
  uploadStatus: string;
  downloadUrl?: string | null;
  /** Loop length (samples) for stacked scheduling. */
  loopLength?: number | null;
};

/** Minimal `ProjectClip` shape needed to derive engine clips. */
export type LoadableProjectClip = {
  _id: string;
  start: number;
  duration: number;
  audioOffset: number;
  mode?: string | null;
  audio?: LoadableProjectAudio | null;
};

function toSchedulingMode(mode: string | null | undefined): ClipSchedulingMode {
  return mode === "STACKED" ? "stacked" : "flat";
}

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
    mode: toSchedulingMode(clip.mode),
    loopLength: audio.loopLength ?? undefined,
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

/**
 * Every distinct {@link ProjectAudio} the engine may need for the current
 * project — the library list plus any audio referenced by a clip. Clip-only
 * audios appear when the Apollo cache has been updated with a new clip but not
 * yet merged into `projectData.audios` (e.g. right after recording).
 */
export function collectProjectAudios(
  audios: readonly LoadableProjectAudio[],
  clips: readonly LoadableProjectClip[],
): LoadableProjectAudio[] {
  const byId = new Map<string, LoadableProjectAudio>();
  for (const audio of audios) byId.set(audio._id, audio);
  for (const clip of clips) {
    const audio = clip.audio;
    if (audio) byId.set(audio._id, audio);
  }
  return filterReadyAudios([...byId.values()]);
}
