import { recordingClipLayout } from "./recordingClipLayout";

export type ClipMode = "FLAT" | "STACKED";

/** Intrinsic timeline placement for one dispatched audio event. */
export type AudioInClipSpec = {
  start: number;
  duration: number;
  audioOffset: number;
};

/** Parent clip trim envelope used to intersect playback windows. */
export type ClipEnvelope = {
  start: number;
  duration: number;
};

/** Effective playback window after intersecting an AudioInClip with its clip envelope. */
export type ScheduledEvent = {
  startSample: number;
  endSample: number;
  bufferOffset: number;
};

/**
 * The number of loop passes stacked within a stacked clip: the recorded audio
 * length divided by the loop length (both in timeline samples), rounded to the
 * nearest whole pass and at least one.
 */
export function stackedLayerCount(
  recordedSamples: number,
  loopLength: number,
): number {
  if (loopLength <= 0) return 1;
  return Math.max(1, Math.round(recordedSamples / loopLength));
}

/**
 * Derive the {@link AudioInClipSpec}s for a clip from its mode and placement.
 * Replaces runtime `deriveEvents` stacking logic.
 */
export function deriveAudioInClips(params: {
  mode: ClipMode;
  clipStart: number;
  clipDuration: number;
  clipAudioOffset: number;
  loopLength?: number;
  recordedSamples: number;
}): AudioInClipSpec[] {
  const {
    mode,
    clipStart,
    clipDuration,
    clipAudioOffset,
    loopLength,
    recordedSamples,
  } = params;

  if (mode === "FLAT") {
    return [
      {
        start: clipStart,
        duration: clipDuration,
        audioOffset: clipAudioOffset,
      },
    ];
  }

  if (loopLength === undefined || loopLength <= 0) {
    throw new Error("STACKED mode requires a positive loopLength");
  }

  const layers = stackedLayerCount(recordedSamples, loopLength);
  return Array.from({ length: layers }, (_, k) => ({
    start: clipStart,
    duration: clipDuration,
    audioOffset: clipAudioOffset + k * loopLength,
  }));
}

/**
 * Derive live-recording {@link AudioInClipSpec}s after the first loop wrap.
 * Returns `null` before the loop boundary is crossed.
 */
export function deriveLiveRecordingAudioInClips(params: {
  startSample: number;
  capturedSamples: number;
  loopLength?: number | null;
  playStart?: number;
  crossedLoopBoundary?: boolean;
  stopSample?: number;
}): AudioInClipSpec[] | null {
  if (!params.crossedLoopBoundary) return null;

  const layout = recordingClipLayout({
    startSample: params.startSample,
    capturedSamples: params.capturedSamples,
    loopLength: params.loopLength,
    playStart: params.playStart,
    crossedLoopBoundary: params.crossedLoopBoundary,
    stopSample: params.stopSample,
  });

  return deriveAudioInClips({
    mode: layout.mode,
    clipStart: layout.start,
    clipDuration: layout.duration,
    clipAudioOffset: 0,
    loopLength: layout.loopLength,
    recordedSamples: params.capturedSamples,
  });
}

/**
 * Intersect an {@link AudioInClipSpec} with its parent clip envelope. The
 * effective event ends at whichever boundary comes first — the intrinsic
 * AudioInClip end or the clip trim end.
 */
export function resolveScheduledEvent(
  aic: AudioInClipSpec,
  clip: ClipEnvelope,
): ScheduledEvent | null {
  const clipEnd = clip.start + clip.duration;
  const aicEnd = aic.start + aic.duration;
  const effectiveStart = Math.max(clip.start, aic.start);
  const effectiveEnd = Math.min(clipEnd, aicEnd);
  if (effectiveStart >= effectiveEnd) return null;

  return {
    startSample: effectiveStart,
    endSample: effectiveEnd,
    bufferOffset: aic.audioOffset + (effectiveStart - aic.start),
  };
}

/** Flatten clips into schedulable events with envelope intersection applied. */
export function flattenAudioInClips(
  clips: readonly {
    id: string;
    audioId: string;
    start: number;
    duration: number;
    audioInClips: readonly AudioInClipSpec[];
  }[],
): Array<
  ScheduledEvent & {
    clipId: string;
    audioId: string;
  }
> {
  const events: Array<
    ScheduledEvent & { clipId: string; audioId: string }
  > = [];

  for (const clip of clips) {
    const envelope: ClipEnvelope = {
      start: clip.start,
      duration: clip.duration,
    };
    for (const aic of clip.audioInClips) {
      const resolved = resolveScheduledEvent(aic, envelope);
      if (!resolved) continue;
      events.push({
        clipId: clip.id,
        audioId: clip.audioId,
        ...resolved,
      });
    }
  }

  return events;
}

export type ValidateClipFields = {
  start: number;
  duration: number;
  audioOffset: number;
  mode: ClipMode;
};

/**
 * Validate client-baked {@link AudioInClipSpec}s against clip fields at creation.
 * Throws when the array does not match the clip mode and placement rules.
 */
export function validateAudioInClips(
  audioInClips: readonly AudioInClipSpec[],
  clip: ValidateClipFields,
  loopLength?: number | null,
): void {
  if (audioInClips.length === 0) {
    throw new Error("audioInClips must contain at least one entry");
  }

  if (clip.mode === "FLAT") {
    if (audioInClips.length !== 1) {
      throw new Error("FLAT clips require exactly one AudioInClip");
    }
    const [aic] = audioInClips;
    if (
      aic.start !== clip.start ||
      aic.duration !== clip.duration ||
      aic.audioOffset !== clip.audioOffset
    ) {
      throw new Error(
        "FLAT AudioInClip must match clip start, duration, and audioOffset",
      );
    }
    return;
  }

  if (loopLength === undefined || loopLength === null || loopLength <= 0) {
    throw new Error("STACKED clips require a positive loopLength on the audio");
  }

  for (let k = 0; k < audioInClips.length; k++) {
    const aic = audioInClips[k]!;
    if (aic.start !== clip.start || aic.duration !== clip.duration) {
      throw new Error(
        "STACKED AudioInClips must share the clip start and duration at creation",
      );
    }
    const expectedOffset = clip.audioOffset + k * loopLength;
    if (aic.audioOffset !== expectedOffset) {
      throw new Error(
        `STACKED AudioInClip ${k} audioOffset must be clip.audioOffset + k * loopLength`,
      );
    }
  }
}

/** Synthesize AudioInClips for legacy clips missing the embedded array. */
export function backfillAudioInClips(
  clip: ValidateClipFields,
  loopLength?: number | null,
  recordedSamples?: number | null,
): AudioInClipSpec[] {
  if (clip.mode === "FLAT") {
    return [
      {
        start: clip.start,
        duration: clip.duration,
        audioOffset: clip.audioOffset,
      },
    ];
  }

  const loop =
    loopLength !== undefined && loopLength !== null && loopLength > 0
      ? loopLength
      : clip.duration;
  const samples = recordedSamples ?? loop;
  return deriveAudioInClips({
    mode: "STACKED",
    clipStart: clip.start,
    clipDuration: clip.duration,
    clipAudioOffset: clip.audioOffset,
    loopLength: loop,
    recordedSamples: samples,
  });
}

/** Shift every AudioInClip start by `delta` when a clip is repositioned. */
export function shiftAudioInClips(
  audioInClips: readonly AudioInClipSpec[],
  delta: number,
): AudioInClipSpec[] {
  if (delta === 0) return [...audioInClips];
  return audioInClips.map((aic) => ({
    ...aic,
    start: aic.start + delta,
  }));
}
