/**
 * Derives the pre-decoded peak data a clip's waveform is drawn from. A
 * {@link ProjectClip} plays a window of its source audio (`audioOffset` →
 * `audioOffset + duration`, in samples), so its waveform shows only that slice,
 * not the whole file. We reduce that slice — mixed down to a single mono
 * channel — to a compact array of signed peaks that `wavesurfer.js` can render
 * directly (skipping its own fetch/decode), and that wavesurfer decimates again
 * to the clip's pixel width at any zoom level.
 *
 * All sample positions are in audio-buffer samples (see `AGENTS.md`).
 */

/**
 * Upper bound on the number of peaks produced for a clip. Caps memory and keeps
 * the array small while staying dense enough to look crisp at the widths a clip
 * reaches on the timeline; wavesurfer interpolates to the exact pixel width.
 */
const MAX_PEAKS = 8_000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Reduce the `[offsetSamples, offsetSamples + durationSamples)` window of
 * `buffer` to a mono array of signed peaks (each the largest-magnitude sample
 * in its bucket, across all channels), suitable to hand to wavesurfer as a
 * single channel's `peaks`.
 *
 * Returns a flat two-point array when the window is empty (out of range or
 * zero-length) so callers always get a renderable, non-empty result.
 */
export function computeClipPeaks(
  buffer: AudioBuffer,
  offsetSamples: number,
  durationSamples: number,
): Float32Array {
  const total = buffer.length;
  const start = clamp(Math.floor(offsetSamples), 0, total);
  const end = clamp(Math.floor(offsetSamples + durationSamples), start, total);
  const windowLength = end - start;
  if (windowLength <= 0) return new Float32Array([0, 0]);

  const points = Math.min(windowLength, MAX_PEAKS);
  const peaks = new Float32Array(points);
  const bucketSize = windowLength / points;
  const channels = buffer.numberOfChannels;

  for (let channel = 0; channel < channels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < points; i++) {
      const from = start + Math.floor(i * bucketSize);
      const to = start + Math.floor((i + 1) * bucketSize);
      let peak = peaks[i];
      for (let j = from; j < to; j++) {
        const sample = data[j];
        if (Math.abs(sample) > Math.abs(peak)) peak = sample;
      }
      peaks[i] = peak;
    }
  }

  return peaks;
}
