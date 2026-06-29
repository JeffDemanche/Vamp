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
  /**
   * Timeline sample where playback loops back to `playStart`. Only consulted
   * when `loop` is `true`; otherwise it is ignored and playback runs
   * indefinitely.
   */
  playEnd: number;
  /**
   * When `true`, reaching `playEnd` restarts playback from `playStart` instead
   * of continuing. When `false`, `playEnd` is ignored and playback runs
   * indefinitely (until stopped or all events finish).
   */
  loop: boolean;
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

/**
 * Acquires the microphone `MediaStream` to record from. Defaults to
 * `getUserMedia({ audio: true })`; injectable for testing. Rejects (e.g.
 * `NotAllowedError`/`NotFoundError`) when access is denied or unavailable — the
 * caller surfaces that to the user.
 */
export type MediaStreamProvider = () => Promise<MediaStream>;

/** Creates the `MediaRecorder` used to capture a take. Injectable for testing. */
export type MediaRecorderFactory = (
  stream: MediaStream,
  options?: MediaRecorderOptions,
) => MediaRecorder;

/**
 * A finished recording plus the metadata needed to place it on the timeline.
 * `startSample`/`durationSamples` are in timeline samples (the engine's
 * `sampleRate`), anchored to the audio clock at capture start/stop so the clip
 * lines up with where playback was when recording ran.
 */
export type RecordingResult = {
  /** The recorded audio, container/codec per {@link RecordingResult.contentType}. */
  blob: Blob;
  /** MIME type of `blob` (e.g. `audio/webm`). */
  contentType: string;
  /** Timeline sample the first recorded frame corresponds to. */
  startSample: number;
  /** Recording length, in timeline samples. */
  durationSamples: number;
};

export type AudioEngineOptions = {
  /**
   * Factory for the underlying `AudioContext`. Defaults to the browser's
   * `AudioContext` (falling back to the legacy `webkitAudioContext`).
   */
  contextFactory?: AudioContextFactory;
  /**
   * Acquires the microphone stream for recording. Defaults to
   * `getUserMedia({ audio: true })`.
   */
  mediaStreamProvider?: MediaStreamProvider;
  /** Creates the `MediaRecorder` used to capture. Defaults to `new MediaRecorder`. */
  mediaRecorderFactory?: MediaRecorderFactory;
};

const EMPTY_STATE: AudioEngineState = {
  clips: [],
  sampleRate: DEFAULT_SAMPLE_RATE,
  playStart: 0,
  playEnd: 0,
  loop: false,
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

const defaultMediaStreamProvider: MediaStreamProvider = () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone capture is not supported in this browser.");
  }
  return navigator.mediaDevices.getUserMedia({ audio: true });
};

const defaultMediaRecorderFactory: MediaRecorderFactory = (stream, options) =>
  new MediaRecorder(stream, options);

/**
 * Candidate recording container/codecs in preference order. We let the browser
 * pick the first it supports (Chrome/Firefox favor WebM/Opus, Safari MP4); the
 * resulting MIME type rides along on the upload so the file can be decoded for
 * playback later.
 */
const RECORDING_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function pickRecordingMimeType(): string | undefined {
  if (
    typeof MediaRecorder === "undefined" ||
    typeof MediaRecorder.isTypeSupported !== "function"
  ) {
    return undefined;
  }
  return RECORDING_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export class AudioEngine {
  private readonly contextFactory: AudioContextFactory;
  private readonly mediaStreamProvider: MediaStreamProvider;
  private readonly mediaRecorderFactory: MediaRecorderFactory;

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

  /** Timer that loops playback back to `playStart` when it reaches `playEnd` (looping only). */
  private endTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly listeners = new Set<PlayingListener>();

  // --- Recording ----------------------------------------------------------

  /** Active recorder while capturing a take, else `null`. */
  private mediaRecorder: MediaRecorder | null = null;
  /** Microphone stream backing the active recorder; tracks are stopped on cleanup. */
  private recordingStream: MediaStream | null = null;
  /** Captured data chunks, assembled into the result blob on stop. */
  private recordedChunks: Blob[] = [];
  /** Audio-clock time (seconds) when capture began — the anchor for duration. */
  private recordStartContextTime = 0;
  /** Timeline sample the first recorded frame corresponds to. */
  private recordStartSample = 0;

  constructor(options: AudioEngineOptions = {}) {
    this.contextFactory = options.contextFactory ?? defaultContextFactory;
    this.mediaStreamProvider =
      options.mediaStreamProvider ?? defaultMediaStreamProvider;
    this.mediaRecorderFactory =
      options.mediaRecorderFactory ?? defaultMediaRecorderFactory;
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
   * Begin playback from the state's `playStart`. No-op if already playing, or if
   * looping is on with an empty loop region (`playEnd <= playStart`).
   */
  play(): void {
    if (this.playing) return;
    const { playStart, playEnd, loop } = this.state;
    if (loop && playEnd <= playStart) return;

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

  // --- Recording ----------------------------------------------------------

  /**
   * Acquire the microphone and begin capturing a take. Resolves only once the
   * recorder has actually started, with the timeline `startSample` the first
   * captured frame maps to — so callers can flip UI/record state *after* audio
   * is truly flowing (no dropped lead-in). Anchors the take to the audio clock
   * at that instant so {@link stopRecording} can report an aligned duration.
   *
   * Rejects if mic access is denied/unavailable (the provider throws) or a
   * recording is already in progress.
   */
  async startRecording(): Promise<{ startSample: number }> {
    if (this.mediaRecorder) {
      throw new Error("A recording is already in progress.");
    }
    const ctx = this.ensureContext();
    const stream = await this.mediaStreamProvider();
    this.recordingStream = stream;

    const mimeType = pickRecordingMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = this.mediaRecorderFactory(
        stream,
        mimeType ? { mimeType } : undefined,
      );
    } catch (err) {
      this.cleanupRecording();
      throw err;
    }

    this.mediaRecorder = recorder;
    this.recordedChunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) this.recordedChunks.push(event.data);
    };

    return new Promise<{ startSample: number }>((resolve, reject) => {
      recorder.onstart = () => {
        // Anchor to the audio clock the instant capture truly begins.
        this.recordStartContextTime = ctx.currentTime;
        this.recordStartSample = this.timecode;
        resolve({ startSample: Math.round(this.recordStartSample) });
      };
      recorder.onerror = (event) => {
        this.cleanupRecording();
        reject(recorderError(event));
      };
      try {
        recorder.start();
      } catch (err) {
        this.cleanupRecording();
        reject(err);
      }
    });
  }

  /**
   * Stop the active recording and resolve with the captured audio plus its
   * timeline placement ({@link RecordingResult}). The duration is measured on
   * the audio clock from capture start to this call, converted to timeline
   * samples via the current `sampleRate`, so the resulting clip spans exactly
   * the stretch of timeline that played while recording.
   *
   * Rejects if no recording is in progress.
   */
  async stopRecording(): Promise<RecordingResult> {
    const recorder = this.mediaRecorder;
    const ctx = this.context;
    if (!recorder || !ctx) {
      throw new Error("No recording is in progress.");
    }

    const elapsedSeconds = Math.max(0, ctx.currentTime - this.recordStartContextTime);
    const durationSamples = Math.round(elapsedSeconds * this.state.sampleRate);
    const startSample = Math.round(this.recordStartSample);

    return new Promise<RecordingResult>((resolve, reject) => {
      recorder.onstop = () => {
        const contentType =
          recorder.mimeType || this.recordedChunks[0]?.type || "audio/webm";
        const blob = new Blob(this.recordedChunks, { type: contentType });
        this.cleanupRecording();
        resolve({ blob, contentType, startSample, durationSamples });
      };
      recorder.onerror = (event) => {
        this.cleanupRecording();
        reject(recorderError(event));
      };
      try {
        recorder.stop();
      } catch (err) {
        this.cleanupRecording();
        reject(err);
      }
    });
  }

  /** Whether the engine is currently capturing a recording. */
  get isRecording(): boolean {
    return this.mediaRecorder !== null;
  }

  /** Stop the recorder (if any) and release the microphone stream. */
  private cleanupRecording(): void {
    if (this.recordingStream) {
      for (const track of this.recordingStream.getTracks()) track.stop();
      this.recordingStream = null;
    }
    this.mediaRecorder = null;
    this.recordedChunks = [];
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
   * position. Clamped to `playEnd` only while looping (otherwise unbounded).
   */
  get timecode(): number {
    if (!this.playing || !this.context) return this.frozenSample;
    const elapsedSeconds = this.context.currentTime - this.contextStartTime;
    const sample = this.playheadStartSample + elapsedSeconds * this.state.sampleRate;
    const { playEnd, loop } = this.state;
    if (loop && sample > playEnd) return playEnd;
    return sample;
  }

  /**
   * Subscribe to `playing` state changes (e.g. so a play/stop button can stay
   * in sync with the transport). Returns an unsubscribe fn.
   */
  subscribe(listener: PlayingListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Tear everything down and release the audio context. */
  dispose(): void {
    this.teardownPlayback();
    this.cleanupRecording();
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
   * Schedule all events relative to `fromSample` against the audio clock and,
   * while looping, arm the loop timer at `playEnd`. Anchors the timecode
   * (`contextStartTime` ↔ `playheadStartSample`) to the moment scheduling
   * happens. The end boundary only applies while looping; otherwise events play
   * to their natural ends and playback runs indefinitely.
   */
  private scheduleFrom(fromSample: number): void {
    const ctx = this.ensureContext();
    const { sampleRate, playEnd, loop } = this.state;

    // `playEnd` is only an end boundary while looping; otherwise unbounded.
    const boundary = loop ? playEnd : null;

    this.contextStartTime = ctx.currentTime;
    this.playheadStartSample = fromSample;

    for (const event of this.events) {
      const buffer = this.audioBuffers.get(event.audioId);
      if (!buffer) continue;

      // The sample window during which this event sounds, intersected with the
      // remaining play range [fromSample, boundary?).
      const windowEnd = boundary === null ? event.endSample : Math.min(event.endSample, boundary);
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

    if (boundary !== null) {
      const secondsUntilEnd = (boundary - fromSample) / sampleRate;
      this.endTimer = setTimeout(() => this.handleEnded(), Math.max(0, secondsUntilEnd * 1000));
    }
  }

  /**
   * Reached `playEnd` while looping: restart from `playStart`. (The loop timer
   * is only armed while looping, so this just re-schedules; the fallback stop is
   * defensive in case state changed.)
   */
  private handleEnded(): void {
    const { loop, playStart } = this.state;
    if (loop) {
      this.teardownPlayback();
      this.scheduleFrom(playStart);
      return;
    }
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

/** Extract a meaningful error from a `MediaRecorder` `error` event. */
function recorderError(event: Event): Error {
  const err = (event as unknown as { error?: DOMException }).error;
  return err ?? new Error("Recording failed.");
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
