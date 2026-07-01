/**
 * Layout and PCM remapping for looped **Recording**s. When a stacked take
 * crosses the playback loop boundary (starts near `playEnd`, stops after the
 * playhead wraps back toward `playStart`), the clip occupies the full loop
 * region and its audio is rearranged into loop coordinates.
 */

/** Whether a looped recording crossed the playback loop boundary. */
export function recordingCrossedLoopBoundary(
  startSample: number,
  stopSample: number,
  loopLength?: number | null,
): boolean {
  return loopLength != null && loopLength > 0 && stopSample < startSample;
}

export type RecordingClipLayout = {
  /** Timeline sample where the clip's left edge sits. */
  start: number;
  /** Clip width, in timeline samples. */
  duration: number;
  mode: "FLAT" | "STACKED";
  loopLength?: number;
  /** When true, chronological PCM must be mapped into loop-region coordinates. */
  wrapped: boolean;
};

/**
 * How a recording (live or finished) occupies the timeline. Flat takes span
 * everything captured so far. Looped takes grow until the first loop point,
 * then lock to one loop region (stacked mode) — matching persisted clip
 * placement. When the take crosses the loop boundary the clip anchors at
 * `playStart` and spans the full loop region instead of starting mid-loop.
 */
export function recordingClipLayout(params: {
  startSample: number;
  capturedSamples: number;
  loopLength?: number | null;
  playStart?: number;
  /**
   * Whether playback looped during capture. When provided this takes precedence
   * over inferring from `stopSample` (which fails once the playhead passes
   * `startSample` again).
   */
  crossedLoopBoundary?: boolean;
  /** Fallback wrap hint when `crossedLoopBoundary` is not supplied. */
  stopSample?: number;
}): RecordingClipLayout {
  const {
    startSample,
    capturedSamples,
    loopLength,
    playStart = 0,
    crossedLoopBoundary,
    stopSample,
  } = params;

  if (!loopLength) {
    return {
      start: startSample,
      duration: capturedSamples,
      mode: "FLAT",
      wrapped: false,
    };
  }

  const wrapped =
    crossedLoopBoundary ??
    (stopSample !== undefined &&
      recordingCrossedLoopBoundary(startSample, stopSample, loopLength));

  if (wrapped) {
    return {
      start: playStart,
      duration: loopLength,
      mode: "STACKED",
      loopLength,
      wrapped: true,
    };
  }

  const duration =
    capturedSamples >= loopLength ? loopLength : capturedSamples;
  return {
    start: startSample,
    duration,
    mode: "STACKED",
    loopLength,
    wrapped: false,
  };
}

/** @deprecated Prefer {@link recordingClipLayout}; kept for existing call sites. */
export function recordingClipDisplay(
  capturedSamples: number,
  loopLength?: number | null,
  options?: {
    startSample?: number;
    playStart?: number;
    stopSample?: number;
    crossedLoopBoundary?: boolean;
  },
): Pick<RecordingClipLayout, "duration" | "mode" | "loopLength"> {
  const { duration, mode, loopLength: loop } = recordingClipLayout({
    startSample: options?.startSample ?? 0,
    capturedSamples,
    loopLength,
    playStart: options?.playStart,
    stopSample: options?.stopSample,
    crossedLoopBoundary: options?.crossedLoopBoundary,
  });
  return { duration, mode, ...(loop !== undefined ? { loopLength: loop } : {}) };
}

/**
 * Map the first loop pass of a wrapped recording from capture order into one
 * loop-region buffer (`loopLength` samples). Later passes (when capture exceeds
 * one loop length) are appended unchanged by {@link finalizeWrappedRecordingPcm}.
 */
export function remapFirstPassToLoopRegion(
  chronological: Float32Array,
  params: {
    startSample: number;
    playStart: number;
    loopLength: number;
  },
): Float32Array {
  const { startSample, playStart, loopLength } = params;
  const out = new Float32Array(loopLength);
  const preWrapSamples = playStart + loopLength - startSample;
  const passLength = Math.min(chronological.length, loopLength);
  const preLen = Math.min(preWrapSamples, passLength);
  const preLoopOffset = startSample - playStart;

  if (preLen > 0) {
    out.set(chronological.subarray(0, preLen), preLoopOffset);
  }

  const postWrapSamples = passLength - preLen;
  if (postWrapSamples > 0) {
    out.set(chronological.subarray(preLen, preLen + postWrapSamples), 0);
  }

  return out;
}

/** Build timeline-rate PCM for a wrapped take (first pass remapped, rest appended). */
export function finalizeWrappedRecordingPcm(
  chronological: Float32Array,
  params: {
    startSample: number;
    playStart: number;
    loopLength: number;
  },
): Float32Array {
  const firstPass = remapFirstPassToLoopRegion(chronological, params);
  const rest = chronological.subarray(params.loopLength);
  if (rest.length === 0) return firstPass;

  const out = new Float32Array(firstPass.length + rest.length);
  out.set(firstPass);
  out.set(rest, firstPass.length);
  return out;
}
