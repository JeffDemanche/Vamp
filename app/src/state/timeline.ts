import { atom, useAtomValue, useSetAtom } from "jotai";

/**
 * Local-only (client) state for the project editor's timeline, modelled with
 * jotai. This module establishes the pattern we reuse for editor state:
 *
 * 1. Define the smallest **base atoms** that hold raw state.
 * 2. Expose **derived atoms** for values computed from the base atoms.
 * 3. Expose **write-only "action" atoms** for the gestures/commands that mutate
 *    state, so components dispatch intent (`pan`, `zoom`) rather than poking at
 *    raw coordinates.
 * 4. Wrap consumption in a small hook so feature/view components get a typed,
 *    stable API and never touch atoms directly.
 *
 * State is scoped per editor instance by rendering a jotai `<Provider>` at the
 * editor boundary (see `TimelineEditor`), so it resets cleanly between projects.
 */

/**
 * Sample rate assumed for the timeline until projects carry their own. The
 * whole timeline is measured in samples (see `AGENTS.md`); converting to/from
 * seconds for the UI uses this value.
 */
export const DEFAULT_SAMPLE_RATE = 44_100;

/** Smallest viewport span (in samples) — caps how far the user can zoom in. */
const MIN_VIEWPORT_DURATION = 1_000;
/** Largest viewport span (in samples) — caps how far the user can zoom out. */
const MAX_VIEWPORT_DURATION = 24 * 60 * 60 * DEFAULT_SAMPLE_RATE; // 24 hours

/**
 * The slice of the timeline currently visible in the `Timeline` component,
 * expressed as the sample coordinates at its left and right edges. Both values
 * may be negative (the timeline extends before sample 0).
 */
export type TimelineViewport = {
  /** Sample coordinate at the left-hand cutoff of the timeline. May be negative. */
  start: number;
  /** Sample coordinate at the right-hand cutoff of the timeline. May be negative. */
  end: number;
};

const DEFAULT_VIEWPORT: TimelineViewport = {
  // A touch of lead-in before sample 0, then ~10 seconds visible.
  start: -DEFAULT_SAMPLE_RATE,
  end: DEFAULT_SAMPLE_RATE * 10,
};

// --- Base atoms -----------------------------------------------------------

/** The visible viewport, in samples. The single source of truth for panning/zoom. */
export const viewportAtom = atom<TimelineViewport>(DEFAULT_VIEWPORT);

/** The sample rate used to interpret the timeline. */
export const sampleRateAtom = atom<number>(DEFAULT_SAMPLE_RATE);

// --- Derived atoms --------------------------------------------------------

/** Sample at the left-hand cutoff of the timeline. */
export const viewportStartAtom = atom((get) => get(viewportAtom).start);

/** Sample at the right-hand cutoff of the timeline. */
export const viewportEndAtom = atom((get) => get(viewportAtom).end);

/** Number of samples spanned by the viewport (always > 0). */
export const viewportDurationAtom = atom((get) => {
  const { start, end } = get(viewportAtom);
  return end - start;
});

// --- Action atoms ---------------------------------------------------------

/**
 * Shift the viewport by a sample delta (positive moves the view later/right).
 * Used by horizontal drag/scroll gestures.
 */
export const panViewportAtom = atom(null, (get, set, deltaSamples: number) => {
  const { start, end } = get(viewportAtom);
  set(viewportAtom, { start: start + deltaSamples, end: end + deltaSamples });
});

/**
 * Zoom the viewport around a focus sample. `factor` < 1 zooms in (shrinks the
 * span), `factor` > 1 zooms out. The focus sample stays under the cursor.
 */
export const zoomViewportAtom = atom(
  null,
  (get, set, { factor, focusSample }: { factor: number; focusSample: number }) => {
    const { start, end } = get(viewportAtom);
    const duration = end - start;
    const targetDuration = clamp(
      duration * factor,
      MIN_VIEWPORT_DURATION,
      MAX_VIEWPORT_DURATION,
    );
    // Re-derive the actual factor after clamping so both edges stay consistent.
    const appliedFactor = targetDuration / duration;
    set(viewportAtom, {
      start: focusSample - (focusSample - start) * appliedFactor,
      end: focusSample + (end - focusSample) * appliedFactor,
    });
  },
);

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// --- Consumption hook -----------------------------------------------------

export type UseTimelineViewport = {
  start: number;
  end: number;
  duration: number;
  sampleRate: number;
  /** Shift the view by a sample delta (positive = later). */
  pan: (deltaSamples: number) => void;
  /** Zoom around `focusSample`; `factor` < 1 zooms in, > 1 zooms out. */
  zoom: (factor: number, focusSample: number) => void;
};

/**
 * Typed access to the timeline viewport state for feature/view components.
 * Reads the derived viewport values and returns stable gesture dispatchers.
 */
export function useTimelineViewport(): UseTimelineViewport {
  const start = useAtomValue(viewportStartAtom);
  const end = useAtomValue(viewportEndAtom);
  const duration = useAtomValue(viewportDurationAtom);
  const sampleRate = useAtomValue(sampleRateAtom);
  const panViewport = useSetAtom(panViewportAtom);
  const zoomViewport = useSetAtom(zoomViewportAtom);

  return {
    start,
    end,
    duration,
    sampleRate,
    pan: panViewport,
    zoom: (factor, focusSample) => zoomViewport({ factor, focusSample }),
  };
}
