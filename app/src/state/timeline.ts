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

/** Playback starts at the origin (sample 0) by default. */
const DEFAULT_PLAY_START = 0;
/**
 * Default playback end, in samples (10 seconds). Always a concrete sample
 * position; it only affects playback when `loop` is enabled (it is the point
 * playback loops back to `playStart`).
 */
const DEFAULT_PLAY_END = DEFAULT_SAMPLE_RATE * 10;
/** Looping is off by default. */
const DEFAULT_LOOP_ENABLED = false;

// --- Base atoms -----------------------------------------------------------

/** The visible viewport, in samples. The single source of truth for panning/zoom. */
export const viewportAtom = atom<TimelineViewport>(DEFAULT_VIEWPORT);

/** The sample rate used to interpret the timeline. */
export const sampleRateAtom = atom<number>(DEFAULT_SAMPLE_RATE);

/**
 * Sample at which playback begins. Always a concrete sample position (it may be
 * negative, mirroring the viewport, but is never null).
 */
export const playStartAtom = atom<number>(DEFAULT_PLAY_START);

/**
 * Sample at which playback loops back to `playStart`. Always a concrete sample
 * position (kept `>= playStart`). It only affects playback when `loop` is
 * enabled; with looping off there is no end boundary and playback continues
 * indefinitely.
 */
export const playEndAtom = atom<number>(DEFAULT_PLAY_END);

/**
 * Whether playback loops back to `playStart` when it reaches `playEnd`. When
 * off, `playEnd` is ignored and playback runs indefinitely. Drives the
 * `AudioEngine`'s loop mode.
 */
export const loopEnabledAtom = atom<boolean>(DEFAULT_LOOP_ENABLED);

/**
 * `_id` of the embedded `ProjectTrack` the user has selected. New recordings
 * land on the selected track; at most one is selected at a time. `null` when
 * none is selected. Persisted on `ProjectUser.selectedTrack`.
 */
export const selectedTrackIdAtom = atom<string | null>(null);

/**
 * `_id`s of the `ProjectClip`s the user has selected on the timeline. Unlike
 * the single-track selection, the timeline supports selecting **multiple**
 * clips at once (e.g. additive clicking) so commands like "archive" can act on
 * the whole set. Empty when nothing is selected. Client-only editor state (not
 * persisted).
 */
export const selectedClipIdsAtom = atom<ReadonlySet<string>>(
  new Set<string>(),
);

/**
 * The live preview of an in-flight clip drag, or `null` when no clip is being
 * dragged. While a `TimelineClip` is dragged it writes the clip's previewed
 * placement here so the rest of the timeline (the drag overlay in `TrackLanes`)
 * can render the clip following the cursor — horizontally at `start` and on
 * `trackId`, which may differ from the clip's persisted track when the pointer
 * moves over another swimlane. The persisted clip only changes on release (via
 * `updateClip`); this is client-only, ephemeral editor state (not persisted).
 */
export type ClipDragState = {
  /** `_id` of the clip being dragged. */
  clipId: string;
  /** Previewed timeline start position, in samples. */
  start: number;
  /** `_id` of the track the clip currently previews on (the lane under the pointer). */
  trackId: string;
};

export const clipDragAtom = atom<ClipDragState | null>(null);

/** Set (or clear, with `null`) the in-flight clip-drag preview. */
export const setClipDragAtom = atom(
  null,
  (_get, set, next: ClipDragState | null) => {
    set(clipDragAtom, next);
  },
);

/**
 * The user's active recording, or `null` when not recording. Persisted on
 * `ProjectUser.recording` so collaborators can observe live recording state.
 */
export type RecordingState = {
  /** `_id` of the track the recording is captured on. */
  trackId: string;
  /** Timeline sample the recording starts at. */
  startSample: number;
  /** Wall-clock instant the recording began (ISO-8601 string). */
  startedAt: string;
  /**
   * Loop length (samples) when the transport was looping at capture start.
   * Omitted for non-looped takes.
   */
  loopLength?: number;
  /**
   * Playback-range start (samples) when recording began — loop anchor for
   * wrapped takes. Omitted for non-looped takes.
   */
  playStart?: number;
};

export const recordingAtom = atom<RecordingState | null>(null);

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
  set(viewportAtom, roundViewport(start + deltaSamples, end + deltaSamples));
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
    set(
      viewportAtom,
      roundViewport(
        focusSample - (focusSample - start) * appliedFactor,
        focusSample + (end - focusSample) * appliedFactor,
      ),
    );
  },
);

/**
 * Move the playback start to a sample position. If the end would end up before
 * the new start, it is pushed along to keep `playEnd >= playStart`.
 */
export const setPlayStartAtom = atom(null, (get, set, sample: number) => {
  const rounded = Math.round(sample);
  set(playStartAtom, rounded);
  if (get(playEndAtom) < rounded) set(playEndAtom, rounded);
});

/**
 * Set the playback end (loop) boundary, clamped so it never falls before the
 * playback start.
 */
export const setPlayEndAtom = atom(null, (get, set, sample: number) => {
  set(playEndAtom, Math.max(Math.round(sample), get(playStartAtom)));
});

/** Which boundary of the playback range a drag is currently controlling. */
export type PlayBoundarySide = "start" | "end";

/**
 * Drag one boundary of the playback range to a sample, **swapping roles** when
 * it crosses the other boundary. If the start handle is dragged past `playEnd`,
 * the old end becomes the new start and the dragged handle takes over as the end
 * (and vice-versa). Returns the side the dragged handle now controls so a
 * continuous drag can keep driving the correct boundary after a swap.
 *
 * Unlike `setPlayStart`/`setPlayEnd` (which push the opposite edge along), this
 * keeps both handles anchored where the user left them and only reinterprets
 * which is "start" vs "end" — the gesture the timeline scrubber handles use.
 */
export const dragPlayBoundaryAtom = atom(
  null,
  (
    get,
    set,
    { side, sample }: { side: PlayBoundarySide; sample: number },
  ): PlayBoundarySide => {
    const rounded = Math.round(sample);
    const start = get(playStartAtom);
    const end = get(playEndAtom);
    if (side === "start") {
      if (rounded > end) {
        set(playStartAtom, end);
        set(playEndAtom, rounded);
        return "end";
      }
      set(playStartAtom, rounded);
      return "start";
    }
    if (rounded < start) {
      set(playEndAtom, start);
      set(playStartAtom, rounded);
      return "start";
    }
    set(playEndAtom, rounded);
    return "end";
  },
);

/** Flip looping on/off. */
export const toggleLoopAtom = atom(null, (get, set) => {
  set(loopEnabledAtom, !get(loopEnabledAtom));
});

/**
 * Select a track by id, or pass `null` to deselect. At most one track is
 * selected at a time.
 */
export const setSelectedTrackIdAtom = atom(
  null,
  (_get, set, trackId: string | null) => {
    set(selectedTrackIdAtom, trackId);
  },
);

/**
 * Toggle a clip in/out of the timeline selection.
 *
 * - `additive` (e.g. ⌘/Ctrl-click): flips just this clip's membership, leaving
 *   the rest of the selection untouched — the gesture for building up a
 *   multi-clip selection.
 * - non-additive (a plain click): collapses the selection to this clip alone,
 *   or clears it entirely when this clip was already the sole selection (so a
 *   plain click still toggles a single clip off).
 */
export const toggleSelectedClipAtom = atom(
  null,
  (
    get,
    set,
    { clipId, additive = false }: { clipId: string; additive?: boolean },
  ) => {
    const current = get(selectedClipIdsAtom);
    if (additive) {
      const next = new Set(current);
      if (next.has(clipId)) next.delete(clipId);
      else next.add(clipId);
      set(selectedClipIdsAtom, next);
      return;
    }
    const isOnlySelection = current.size === 1 && current.has(clipId);
    set(selectedClipIdsAtom, isOnlySelection ? new Set() : new Set([clipId]));
  },
);

/** Replace the clip selection with an explicit set of ids. */
export const setSelectedClipIdsAtom = atom(
  null,
  (_get, set, clipIds: Iterable<string>) => {
    set(selectedClipIdsAtom, new Set(clipIds));
  },
);

/** Clear the clip selection. */
export const clearSelectedClipsAtom = atom(null, (_get, set) => {
  set(selectedClipIdsAtom, new Set<string>());
});

/** Begin recording on `trackId` at `startSample`. */
export const startRecordingAtom = atom(
  null,
  (
    _get,
    set,
    {
      trackId,
      startSample,
      loopLength,
      playStart,
    }: {
      trackId: string;
      startSample: number;
      loopLength?: number;
      playStart?: number;
    },
  ) => {
    set(recordingAtom, {
      trackId,
      startSample: Math.round(startSample),
      startedAt: new Date().toISOString(),
      ...(loopLength !== undefined ? { loopLength } : {}),
      ...(playStart !== undefined ? { playStart } : {}),
    });
  },
);

/** End the active recording. */
export const stopRecordingAtom = atom(null, (_get, set) => {
  set(recordingAtom, null);
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Build a viewport with integer sample edges. The timeline is measured in whole
 * samples (see `AGENTS.md`), and these coordinates are persisted to the server's
 * integer-typed `ProjectUser` fields, so zoom/pan math must be rounded before it
 * lands in the viewport atom.
 */
function roundViewport(start: number, end: number): TimelineViewport {
  return { start: Math.round(start), end: Math.round(end) };
}

// --- Persisted editor state -----------------------------------------------

/**
 * The slice of editor state persisted per user on the server (the `ProjectUser`
 * model): the timeline viewport plus the playback range and loop flag. These
 * are values that belong to one user's *view* of a project rather than its
 * shared content.
 *
 * Aggregated into a single derived atom so one listener (`ProjectUserSync`) can
 * watch and sync it. To persist a new piece of view state, add a field here and
 * to the server `ProjectUser` — the sync picks it up automatically.
 */
export type PersistedEditorState = {
  viewportStart: number;
  viewportEnd: number;
  playStart: number;
  playEnd: number;
  loop: boolean;
  selectedTrack: string | null;
  recording: {
    track: string;
    startSample: number;
    startedAt: string;
  } | null;
};

export const persistedEditorStateAtom = atom<PersistedEditorState>((get) => {
  const recording = get(recordingAtom);
  return {
    viewportStart: get(viewportStartAtom),
    viewportEnd: get(viewportEndAtom),
    playStart: get(playStartAtom),
    playEnd: get(playEndAtom),
    loop: get(loopEnabledAtom),
    selectedTrack: get(selectedTrackIdAtom),
    recording: recording
      ? {
          track: recording.trackId,
          startSample: recording.startSample,
          startedAt: recording.startedAt,
        }
      : null,
  };
});

/** Read the aggregated editor view state that is persisted per user. */
export function usePersistedEditorState(): PersistedEditorState {
  return useAtomValue(persistedEditorStateAtom);
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

export type UseTimelinePlayback = {
  /** Sample where playback begins. */
  playStart: number;
  /** Sample where playback loops back to `playStart`. Only matters when `loop` is on. */
  playEnd: number;
  /** Whether playback loops back to `playStart` upon reaching `playEnd`. */
  loop: boolean;
  /** Move the playback start to a sample position. */
  setPlayStart: (sample: number) => void;
  /** Set the playback end (loop) boundary. */
  setPlayEnd: (sample: number) => void;
  /**
   * Drag one boundary of the play range, swapping start/end when it crosses the
   * other. Returns the side now under the dragged handle (see
   * `dragPlayBoundaryAtom`).
   */
  dragPlayBoundary: (side: PlayBoundarySide, sample: number) => PlayBoundarySide;
  /** Toggle looping on/off. */
  toggleLoop: () => void;
};

/**
 * Typed access to the timeline's playback range (`playStart`/`playEnd`/`loop`)
 * for feature/view components, returning stable setters that keep the range
 * ordered.
 */
export function useTimelinePlayback(): UseTimelinePlayback {
  const playStart = useAtomValue(playStartAtom);
  const playEnd = useAtomValue(playEndAtom);
  const loop = useAtomValue(loopEnabledAtom);
  const setPlayStart = useSetAtom(setPlayStartAtom);
  const setPlayEnd = useSetAtom(setPlayEndAtom);
  const dragBoundary = useSetAtom(dragPlayBoundaryAtom);
  const toggleLoop = useSetAtom(toggleLoopAtom);

  return {
    playStart,
    playEnd,
    loop,
    setPlayStart,
    setPlayEnd,
    dragPlayBoundary: (side, sample) => dragBoundary({ side, sample }),
    toggleLoop,
  };
}

export type UseSelectedTrack = {
  /** `_id` of the selected track, or `null` when none is selected. */
  selectedTrackId: string | null;
  /** Select a track by id, or pass `null` to deselect. */
  setSelectedTrackId: (trackId: string | null) => void;
};

/** Typed access to the user's selected track for feature/view components. */
export function useSelectedTrack(): UseSelectedTrack {
  const selectedTrackId = useAtomValue(selectedTrackIdAtom);
  const setSelectedTrackId = useSetAtom(setSelectedTrackIdAtom);
  return { selectedTrackId, setSelectedTrackId };
}

export type UseSelectedClips = {
  /** `_id`s of every currently-selected clip. Empty when none is selected. */
  selectedClipIds: ReadonlySet<string>;
  /** Whether a clip is part of the current selection. */
  isClipSelected: (clipId: string) => boolean;
  /**
   * Toggle a clip's selection. Pass `additive` (⌘/Ctrl-click) to add/remove it
   * without disturbing the rest of the selection; otherwise the selection
   * collapses to just this clip (or clears if it was the sole selection).
   */
  toggleClip: (clipId: string, additive?: boolean) => void;
  /** Replace the selection with an explicit set of ids. */
  setSelectedClips: (clipIds: Iterable<string>) => void;
  /** Clear the selection. */
  clearSelection: () => void;
};

/** Typed access to the user's selected clips for feature/view components. */
export function useSelectedClips(): UseSelectedClips {
  const selectedClipIds = useAtomValue(selectedClipIdsAtom);
  const toggle = useSetAtom(toggleSelectedClipAtom);
  const setSelected = useSetAtom(setSelectedClipIdsAtom);
  const clear = useSetAtom(clearSelectedClipsAtom);

  return {
    selectedClipIds,
    isClipSelected: (clipId) => selectedClipIds.has(clipId),
    toggleClip: (clipId, additive = false) => toggle({ clipId, additive }),
    setSelectedClips: setSelected,
    clearSelection: clear,
  };
}

/**
 * Read the in-flight clip-drag preview (or `null`). Used by the drag overlay in
 * `TrackLanes` to draw the dragged clip following the cursor. Subscribes to the
 * preview, so only consumers that need to *render* it (not the clip dispatching
 * the drag) should use this.
 */
export function useClipDrag(): ClipDragState | null {
  return useAtomValue(clipDragAtom);
}

/**
 * Setter for the in-flight clip-drag preview. Write-only (does not subscribe),
 * so the `TimelineClip` driving the gesture can update the preview on every
 * pointer-move without re-rendering itself.
 */
export function useSetClipDrag(): (next: ClipDragState | null) => void {
  return useSetAtom(setClipDragAtom);
}

export type UseRecording = {
  /** The active recording, or `null` when not recording. */
  recording: RecordingState | null;
  /** Whether a recording is currently in progress. */
  isRecording: boolean;
  /** Begin recording on `trackId` at `startSample`. */
  startRecording: (
    trackId: string,
    startSample: number,
    loopLength?: number,
    playStart?: number,
  ) => void;
  /** End the active recording. */
  stopRecording: () => void;
};

/** Typed access to the user's recording state for feature/view components. */
export function useRecording(): UseRecording {
  const recording = useAtomValue(recordingAtom);
  const start = useSetAtom(startRecordingAtom);
  const stop = useSetAtom(stopRecordingAtom);

  return {
    recording,
    isRecording: recording !== null,
    startRecording: (trackId, startSample, loopLength, playStart) =>
      start({ trackId, startSample, loopLength, playStart }),
    stopRecording: stop,
  };
}
