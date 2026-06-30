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

/** How a clip schedules its underlying audio for playback. */
export type ClipSchedulingMode = "flat" | "stacked";

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
   * How this clip schedules its underlying audio. `flat` plays once; `stacked`
   * re-triggers at every loop point (see `loopLength`).
   */
  mode: ClipSchedulingMode;
  /**
   * Loop length (samples) for stacked scheduling — taken from the audio record.
   * Ignored for flat clips.
   */
  loopLength?: number;
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

/**
 * Notified whenever the in-memory audio store changes (a buffer is loaded or
 * removed). Lets the UI react when a clip's audio finishes downloading/decoding
 * — e.g. to draw its waveform once the bytes are available.
 */
export type AudioStoreListener = () => void;
type RecordingBufferListener = () => void;

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
  /**
   * Loop length (samples) active when recording began, if the transport was
   * looping. Omitted for non-looped takes.
   */
  loopLength?: number;
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

  /** Notified when the audio-buffer store changes (load/remove/clear). */
  private readonly audioStoreListeners = new Set<AudioStoreListener>();

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
  /** Loop length (samples) captured when recording began, if looping. */
  private recordLoopLength: number | undefined;

  /** Taps the mic stream for live waveform preview while recording. */
  private recordingSource: MediaStreamAudioSourceNode | null = null;
  private recordingProcessor: ScriptProcessorNode | null = null;
  private recordingSilentGain: GainNode | null = null;
  /** Mono PCM accumulated from the live mic tap, at the context sample rate. */
  private recordingChannelData: Float32Array[] = [];
  /** Cached resampled buffer returned by {@link getRecordingBuffer}. */
  private recordingBufferCache: AudioBuffer | undefined;
  private recordingBufferCacheSourceLength = 0;
  private recordingBufferCacheSampleRate = 0;
  private readonly recordingBufferListeners = new Set<RecordingBufferListener>();
  private recordingBufferNotifyPending = false;

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
    this.notifyAudioStore();
  }

  /** Store an already-decoded buffer directly (e.g. generated audio, tests). */
  setAudioBuffer(id: AudioId, buffer: AudioBuffer): void {
    this.audioBuffers.set(id, buffer);
    this.notifyAudioStore();
  }

  hasAudio(id: AudioId): boolean {
    return this.audioBuffers.has(id);
  }

  /**
   * The decoded buffer held under `id`, or `undefined` when it has not been
   * loaded yet. Exposes the engine's already-downloaded/decoded audio so the UI
   * can derive waveforms from it without re-fetching the file.
   */
  getAudioBuffer(id: AudioId): AudioBuffer | undefined {
    return this.audioBuffers.get(id);
  }

  /** Forget an in-memory audio file. Does not affect in-flight playback. */
  removeAudio(id: AudioId): void {
    if (this.audioBuffers.delete(id)) this.notifyAudioStore();
  }

  /**
   * Subscribe to audio-store changes (a buffer loaded, removed, or cleared).
   * Returns an unsubscribe fn. Consumers that render audio (e.g. clip
   * waveforms) use this to re-read {@link getAudioBuffer} when bytes land.
   */
  subscribeAudioStore(listener: AudioStoreListener): () => void {
    this.audioStoreListeners.add(listener);
    return () => this.audioStoreListeners.delete(listener);
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
    this.events = this.deriveEvents(state.clips);

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
   * When `startPlayback` is set, the engine also begins playback (from
   * `playStart`, if not already playing) in the *same* synchronous instant that
   * capture starts, so the take and the transport share one audio-clock anchor.
   * Starting playback separately after this resolves would lag capture by the
   * promise/render delay, leaving the recorded clip drifting ahead of the
   * playhead — so prefer this over a separate {@link play} call when recording.
   *
   * Rejects if mic access is denied/unavailable (the provider throws) or a
   * recording is already in progress.
   */
  async startRecording(
    options: { startPlayback?: boolean } = {},
  ): Promise<{ startSample: number; loopLength?: number }> {
    const { startPlayback = false } = options;
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
    this.setupRecordingTap(ctx, stream);

    return new Promise<{ startSample: number; loopLength?: number }>((resolve, reject) => {
      recorder.onstart = () => {
        // Start the transport in the very same instant capture begins (no-op if
        // already playing) so playback and the recording anchor to one audio
        // clock time — eliminating the lag a later, separate `play()` would add.
        if (startPlayback) this.play();
        // Anchor to the audio clock the instant capture truly begins.
        this.recordStartContextTime = ctx.currentTime;
        this.recordStartSample = this.timecode;
        const { loop, playStart, playEnd } = this.state;
        this.recordLoopLength =
          loop && playEnd > playStart ? playEnd - playStart : undefined;
        resolve({
          startSample: Math.round(this.recordStartSample),
          loopLength: this.recordLoopLength,
        });
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
    const loopLength = this.recordLoopLength;

    return new Promise<RecordingResult>((resolve, reject) => {
      recorder.onstop = () => {
        const contentType =
          recorder.mimeType || this.recordedChunks[0]?.type || "audio/webm";
        const blob = new Blob(this.recordedChunks, { type: contentType });
        this.cleanupRecording();
        resolve({ blob, contentType, startSample, durationSamples, loopLength });
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

  /**
   * How much audio has been captured so far during an active recording, in
   * timeline samples. Measured on the audio clock from capture start (same
   * basis as {@link stopRecording}), so it keeps increasing when the transport
   * loops and the playhead wraps — unlike `timecode - startSample`.
   */
  getRecordingCapturedSamples(): number {
    if (!this.mediaRecorder || !this.context) return 0;
    const elapsedSeconds = Math.max(
      0,
      this.context.currentTime - this.recordStartContextTime,
    );
    return Math.round(elapsedSeconds * this.state.sampleRate);
  }

  /**
   * The PCM captured so far during an active recording, resampled to the
   * timeline `sampleRate`, or `undefined` when not recording / before the first
   * frame lands. Used by the live `RecordingClip` waveform.
   */
  getRecordingBuffer(): AudioBuffer | undefined {
    const ctx = this.context;
    if (!ctx || !this.mediaRecorder) return undefined;
    const src = this.recordingChannelData[0];
    if (!src || src.length === 0) return undefined;

    const timelineRate = this.state.sampleRate;
    if (
      this.recordingBufferCache &&
      this.recordingBufferCacheSourceLength === src.length &&
      this.recordingBufferCacheSampleRate === timelineRate
    ) {
      return this.recordingBufferCache;
    }

    const contextRate = ctx.sampleRate;
    let buffer: AudioBuffer;
    if (timelineRate === contextRate) {
      buffer = ctx.createBuffer(1, src.length, timelineRate);
      buffer.copyToChannel(new Float32Array(src), 0);
    } else {
      const outLength = Math.max(
        1,
        Math.round((src.length * timelineRate) / contextRate),
      );
      const out = new Float32Array(outLength);
      for (let i = 0; i < outLength; i++) {
        const srcPos = (i * contextRate) / timelineRate;
        const idx = Math.floor(srcPos);
        const frac = srcPos - idx;
        const a = src[idx] ?? 0;
        const b = src[idx + 1] ?? a;
        out[i] = a + frac * (b - a);
      }
      buffer = ctx.createBuffer(1, outLength, timelineRate);
      buffer.copyToChannel(out, 0);
    }

    this.recordingBufferCache = buffer;
    this.recordingBufferCacheSourceLength = src.length;
    this.recordingBufferCacheSampleRate = timelineRate;
    return buffer;
  }

  /**
   * Subscribe to live recording-buffer updates (PCM appended from the mic tap).
   * Returns an unsubscribe fn.
   */
  subscribeRecordingBuffer(listener: RecordingBufferListener): () => void {
    this.recordingBufferListeners.add(listener);
    return () => this.recordingBufferListeners.delete(listener);
  }

  /** Stop the recorder (if any) and release the microphone stream. */
  private cleanupRecording(): void {
    this.teardownRecordingTap();
    if (this.recordingStream) {
      for (const track of this.recordingStream.getTracks()) track.stop();
      this.recordingStream = null;
    }
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordLoopLength = undefined;
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
    this.notifyAudioStore();
    this.listeners.clear();
    this.audioStoreListeners.clear();
    this.recordingBufferListeners.clear();
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

  /**
   * Derive the playback events for the current clips. A flat clip yields one
   * event spanning its timeline window. A **stacked** clip occupies a single
   * loop region (its `duration`) and overlays every recorded loop pass on top
   * of itself within that region: one event per pass, all starting at the
   * clip's start (truncated at the clip end) but reading a different
   * `loopLength`-sized slice of the underlying recording
   * (`bufferOffset += k * loopLength`). The pass count comes from the decoded
   * recording's length, so it is only correct once the buffer has loaded —
   * {@link update} re-derives as buffers land.
   */
  private deriveEvents(clips: AudioEngineClip[]): AudioEvent[] {
    const events: AudioEvent[] = [];
    for (const clip of clips) {
      const bufferOffset = clip.offset ?? 0;
      const clipEnd = clip.start + clip.duration;
      const loopLength = clip.loopLength;

      if (clip.mode !== "stacked" || loopLength === undefined || loopLength <= 0) {
        events.push({
          clipId: clip.id,
          audioId: clip.audioId,
          startSample: clip.start,
          endSample: clipEnd,
          bufferOffset,
        });
        continue;
      }

      const layers = this.stackLayerCount(clip.audioId, loopLength);
      for (let k = 0; k < layers; k++) {
        events.push({
          clipId: clip.id,
          audioId: clip.audioId,
          startSample: clip.start,
          endSample: clipEnd,
          bufferOffset: bufferOffset + k * loopLength,
        });
      }
    }
    return events;
  }

  /**
   * How many loop passes a stacked clip's recording contains. Derived from the
   * decoded buffer's `duration` (seconds, decode-rate independent) scaled to
   * timeline samples and divided by `loopLength`. Returns `1` until the buffer
   * has loaded (the event list is re-derived once it does).
   */
  private stackLayerCount(audioId: AudioId, loopLength: number): number {
    const buffer = this.audioBuffers.get(audioId);
    if (!buffer) return 1;
    return stackedLayerCount(buffer.duration * this.state.sampleRate, loopLength);
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.playing);
  }

  private notifyAudioStore(): void {
    for (const listener of this.audioStoreListeners) listener();
  }

  private setupRecordingTap(ctx: AudioContext, stream: MediaStream): void {
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    const silent = ctx.createGain();
    silent.gain.value = 0;
    source.connect(processor);
    processor.connect(silent);
    silent.connect(ctx.destination);

    this.recordingSource = source;
    this.recordingProcessor = processor;
    this.recordingSilentGain = silent;
    this.recordingChannelData = [new Float32Array(0)];

    processor.onaudioprocess = (event) => {
      if (!this.mediaRecorder) return;
      this.appendRecordingSamples(event.inputBuffer.getChannelData(0));
    };
  }

  private teardownRecordingTap(): void {
    this.recordingProcessor?.disconnect();
    this.recordingSource?.disconnect();
    this.recordingSilentGain?.disconnect();
    this.recordingProcessor = null;
    this.recordingSource = null;
    this.recordingSilentGain = null;
    this.recordingChannelData = [];
    this.recordingBufferCache = undefined;
    this.recordingBufferCacheSourceLength = 0;
    this.recordingBufferCacheSampleRate = 0;
    this.notifyRecordingBuffer();
  }

  private appendRecordingSamples(input: Float32Array): void {
    const channel = this.recordingChannelData[0] ?? new Float32Array(0);
    const next = new Float32Array(channel.length + input.length);
    next.set(channel);
    next.set(input, channel.length);
    this.recordingChannelData[0] = next;
    this.notifyRecordingBuffer();
  }

  private notifyRecordingBuffer(): void {
    if (this.recordingBufferNotifyPending) return;
    this.recordingBufferNotifyPending = true;
    requestAnimationFrame(() => {
      this.recordingBufferNotifyPending = false;
      for (const listener of this.recordingBufferListeners) listener();
    });
  }
}

/** Extract a meaningful error from a `MediaRecorder` `error` event. */
function recorderError(event: Event): Error {
  const err = (event as unknown as { error?: DOMException }).error;
  return err ?? new Error("Recording failed.");
}

/**
 * The number of loop passes stacked within a stacked clip: the recorded audio
 * length divided by the loop length (both in timeline samples), rounded to the
 * nearest whole pass and at least one. Shared by the engine's scheduling and
 * the UI's mode badge so both agree on how many layers/events a stacked clip
 * has.
 */
export function stackedLayerCount(
  recordedSamples: number,
  loopLength: number,
): number {
  if (loopLength <= 0) return 1;
  return Math.max(1, Math.round(recordedSamples / loopLength));
}
