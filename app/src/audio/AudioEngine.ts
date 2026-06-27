import { DEFAULT_SAMPLE_RATE } from "@/state/timeline";

/**
 * `AudioEngine` is the client's bridge between the editor UI, the Web Audio API,
 * the decoded audio files it keeps in memory, and the playback **events**
 * derived from a project's clips.
 *
 * Responsibilities:
 *
 * - **In-memory audio store.** Decoded `AudioBuffer`s are kept in a map keyed by
 *   an opaque audio id (`loadAudio`/`setAudioBuffer`). Clips reference audio by
 *   that id.
 * - **State reflection.** `update` accepts the slice of editor state the engine
 *   depends on (the project's clips plus the timeline's sample rate and playback
 *   range) and reflects it internally, re-deriving the {@link AudioEvent} list —
 *   and, if playback is in flight, re-scheduling on the fly.
 * - **Transport.** `play`/`stop` begin and end playback. When playback begins,
 *   each event is handed to the Web Audio API as an `AudioBufferSourceNode`
 *   scheduled relative to the audio clock.
 * - **Timecode.** The engine tracks the audio-clock timestamp and timeline
 *   sample at which playback started, so `timecode` can report the current
 *   timeline position (in samples) accurately at any instant. The UI is expected
 *   to poll this getter (e.g. on `requestAnimationFrame`) to draw a playhead.
 *
 * Everything time-related is measured in **samples** (see `AGENTS.md`); the
 * `sampleRate` from the synced state converts between samples and the Web Audio
 * clock's seconds.
 *
 * The Web Audio `AudioContext` is created lazily (on first `loadAudio`/`play`)
 * so construction is side-effect free and the context is only spun up after a
 * user gesture, satisfying browser autoplay policies. A context factory can be
 * injected for testing.
 */

/** Identifier for an audio file held in the engine's in-memory store. */
export type AudioId = string;

/**
 * A clip as the audio engine needs to see it. Upstream code maps a project's
 * `ProjectClip`s (plus their audio association) into this shape. All times are
 * in samples.
 */
export type AudioEngineClip = {
  /** The source clip's id; carried onto the derived {@link AudioEvent}. */
  id: string;
  /** Which in-memory audio file this clip plays. */
  audioId: AudioId;
  /** Timeline sample at which the clip begins. */
  start: number;
  /** Clip length, in samples. */
  duration: number;
  /**
   * Sample offset into the source audio file at which the clip's audio begins.
   * Defaults to `0` (play the file from its start).
   */
  offset?: number;
};

/**
 * The slice of editor state the engine depends on. Pass the whole object to
 * {@link AudioEngine.update} whenever any of it changes; the engine reflects it
 * internally rather than reaching back into the UI's state.
 */
export type AudioEngineState = {
  /** Clips to (potentially) play, in timeline-sample coordinates. */
  clips: AudioEngineClip[];
  /** Samples per second, used to convert between samples and the audio clock. */
  sampleRate: number;
  /** Timeline sample where playback begins. */
  playStart: number;
  /** Timeline sample where playback stops/loops, or `null` to play indefinitely. */
  playEnd: number | null;
};

/**
 * A scheduled-able unit of playback derived from a clip — what the engine
 * actually hands to the Web Audio API. Recomputed by {@link AudioEngine.update}
 * from the current clips. Times are in samples.
 */
export type AudioEvent = {
  /** The originating clip's id. */
  clipId: string;
  /** The in-memory audio file this event plays. */
  audioId: AudioId;
  /** Timeline sample where the event starts sounding. */
  startSample: number;
  /** Timeline sample where the event stops sounding. */
  endSample: number;
  /** Sample offset into the source buffer corresponding to `startSample`. */
  bufferOffset: number;
};

/** Notified whenever the engine's `playing` state flips. */
export type PlayingListener = (playing: boolean) => void;

/** Creates the `AudioContext` the engine drives. Injectable for testing. */
export type AudioContextFactory = () => AudioContext;

export type AudioEngineOptions = {
  /**
   * Factory for the underlying `AudioContext`. Defaults to the browser's
   * `AudioContext` (falling back to the legacy `webkitAudioContext`).
   */
  contextFactory?: AudioContextFactory;
};

const EMPTY_STATE: AudioEngineState = {
  clips: [],
  sampleRate: DEFAULT_SAMPLE_RATE,
  playStart: 0,
  playEnd: null,
};

const defaultContextFactory: AudioContextFactory = () => {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) {
    throw new Error("Web Audio API is not available in this environment.");
  }
  return new Ctor();
};

export class AudioEngine {
  private readonly contextFactory: AudioContextFactory;

  /** Decoded audio files, keyed by audio id. The "audio files in memory". */
  private readonly audioBuffers = new Map<AudioId, AudioBuffer>();

  /** Latest reflected editor state. */
  private state: AudioEngineState = EMPTY_STATE;

  /** Playback events derived from the current clips. */
  private events: AudioEvent[] = [];

  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  /** Currently sounding source nodes, tracked so they can be stopped. */
  private activeSources: AudioBufferSourceNode[] = [];

  private playing = false;

  /**
   * Audio-clock time (seconds) at which the current playback run started — the
   * anchor for converting the audio clock to a timeline sample.
   */
  private contextStartTime = 0;

  /** Timeline sample that `contextStartTime` corresponds to. */
  private playheadStartSample = 0;

  /** Timeline sample reported while not playing (the cued/last-stopped point). */
  private frozenSample = 0;

  /** Timer that stops playback when it reaches `playEnd`. */
  private endTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly listeners = new Set<PlayingListener>();

  constructor(options: AudioEngineOptions = {}) {
    this.contextFactory = options.contextFactory ?? defaultContextFactory;
  }

  // --- Audio file store ---------------------------------------------------

  /**
   * Decode `data` and keep the resulting buffer in memory under `id`. Clips
   * with a matching `audioId` will play it.
   */
  async loadAudio(id: AudioId, data: ArrayBuffer): Promise<void> {
    const ctx = this.ensureContext();
    const buffer = await ctx.decodeAudioData(data);
    this.audioBuffers.set(id, buffer);
  }

  /** Store an already-decoded buffer directly (e.g. generated audio, tests). */
  setAudioBuffer(id: AudioId, buffer: AudioBuffer): void {
    this.audioBuffers.set(id, buffer);
  }

  hasAudio(id: AudioId): boolean {
    return this.audioBuffers.has(id);
  }

  /** Forget an in-memory audio file. Does not affect in-flight playback. */
  removeAudio(id: AudioId): void {
    this.audioBuffers.delete(id);
  }

  // --- State reflection ---------------------------------------------------

  /**
   * Reflect the latest editor state into the engine. Re-derives the
   * {@link AudioEvent} list from the clips. While stopped, the reported
   * `timecode` is cued to the new `playStart`; while playing, the events are
   * re-scheduled from the current position so edits take effect live.
   */
  update(state: AudioEngineState): void {
    this.state = state;
    this.events = deriveEvents(state.clips);

    if (this.playing) {
      const resumeFrom = this.timecode;
      this.teardownPlayback();
      this.scheduleFrom(resumeFrom);
    } else {
      this.frozenSample = state.playStart;
    }
  }

  // --- Transport ----------------------------------------------------------

  /**
   * Begin playback from the state's `playStart`. No-op if already playing or if
   * the playback range is empty (`playEnd <= playStart`).
   */
  play(): void {
    if (this.playing) return;
    const { playStart, playEnd } = this.state;
    if (playEnd !== null && playEnd <= playStart) return;

    this.playing = true;
    this.scheduleFrom(playStart);
    this.notify();
  }

  /**
   * End playback, freezing the reported `timecode` at the position playback
   * reached. No-op if not playing.
   */
  stop(): void {
    if (!this.playing) return;
    this.frozenSample = this.timecode;
    this.teardownPlayback();
    this.playing = false;
    this.notify();
  }

  // --- Reported state -----------------------------------------------------

  /** Whether playback is currently in flight. */
  get isPlaying(): boolean {
    return this.playing;
  }

  /** The playback events currently derived from the project's clips. */
  get audioEvents(): readonly AudioEvent[] {
    return this.events;
  }

  /**
   * The current timeline position, in samples. While playing it is computed
   * live from the audio clock; while stopped it holds the cued/last-stopped
   * position. Clamped to `playEnd` when one is set.
   */
  get timecode(): number {
    if (!this.playing || !this.context) return this.frozenSample;
    const elapsedSeconds = this.context.currentTime - this.contextStartTime;
    const sample = this.playheadStartSample + elapsedSeconds * this.state.sampleRate;
    const { playEnd } = this.state;
    if (playEnd !== null && sample > playEnd) return playEnd;
    return sample;
  }

  /**
   * Subscribe to `playing` state changes (e.g. so a play/stop button can flip
   * when playback ends naturally at `playEnd`). Returns an unsubscribe fn.
   */
  subscribe(listener: PlayingListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Tear everything down and release the audio context. */
  dispose(): void {
    this.teardownPlayback();
    this.playing = false;
    this.audioBuffers.clear();
    this.listeners.clear();
    if (this.context) {
      void this.context.close();
      this.context = null;
      this.masterGain = null;
    }
  }

  // --- Internals ----------------------------------------------------------

  private ensureContext(): AudioContext {
    if (!this.context) {
      this.context = this.contextFactory();
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);
    }
    if (this.context.state === "suspended") {
      void this.context.resume();
    }
    return this.context;
  }

  /**
   * Schedule all events relative to `fromSample` against the audio clock and
   * arm the auto-stop timer. Anchors the timecode (`contextStartTime` ↔
   * `playheadStartSample`) to the moment scheduling happens.
   */
  private scheduleFrom(fromSample: number): void {
    const ctx = this.ensureContext();
    const { sampleRate, playEnd } = this.state;

    this.contextStartTime = ctx.currentTime;
    this.playheadStartSample = fromSample;

    for (const event of this.events) {
      const buffer = this.audioBuffers.get(event.audioId);
      if (!buffer) continue;

      // The sample window during which this event sounds, intersected with the
      // remaining play range [fromSample, playEnd?).
      const windowEnd = playEnd === null ? event.endSample : Math.min(event.endSample, playEnd);
      const soundStart = Math.max(event.startSample, fromSample);
      if (soundStart >= windowEnd) continue; // entirely before us or past the end

      const whenSeconds = ctx.currentTime + (soundStart - fromSample) / sampleRate;
      const offsetSamples = event.bufferOffset + (soundStart - event.startSample);
      const durationSamples = windowEnd - soundStart;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.masterGain!);
      source.start(whenSeconds, offsetSamples / sampleRate, durationSamples / sampleRate);
      this.activeSources.push(source);
    }

    if (playEnd !== null) {
      const secondsUntilEnd = (playEnd - fromSample) / sampleRate;
      this.endTimer = setTimeout(() => this.handleEnded(), Math.max(0, secondsUntilEnd * 1000));
    }
  }

  /** Reached `playEnd`: freeze at the boundary and report a stop. */
  private handleEnded(): void {
    this.frozenSample = this.timecode;
    this.teardownPlayback();
    this.playing = false;
    this.notify();
  }

  private teardownPlayback(): void {
    if (this.endTimer !== null) {
      clearTimeout(this.endTimer);
      this.endTimer = null;
    }
    for (const source of this.activeSources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Already stopped/ended — safe to ignore.
      }
      source.disconnect();
    }
    this.activeSources = [];
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.playing);
  }
}

function deriveEvents(clips: AudioEngineClip[]): AudioEvent[] {
  return clips.map((clip) => ({
    clipId: clip.id,
    audioId: clip.audioId,
    startSample: clip.start,
    endSample: clip.start + clip.duration,
    bufferOffset: clip.offset ?? 0,
  }));
}
