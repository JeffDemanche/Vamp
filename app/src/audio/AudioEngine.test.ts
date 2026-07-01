import { AudioEngine, type AudioEngineClip, type AudioEngineState } from "./AudioEngine";

/**
 * jsdom has no Web Audio API, so we drive the engine with a hand-rolled fake
 * `AudioContext` whose clock we advance manually. The fake records every source
 * node it hands out (and how it was scheduled) so tests can assert on what the
 * engine asked the Web Audio API to play.
 */

type StartCall = { when: number; offset?: number; duration?: number };

class FakeAudioParam {
  value = 1;
}

class FakeGainNode {
  gain = new FakeAudioParam();
  connect = jest.fn();
  disconnect = jest.fn();
}

class FakeBufferSource {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  startCall: StartCall | null = null;
  stopped = false;
  connect = jest.fn();
  disconnect = jest.fn();

  start(when = 0, offset?: number, duration?: number) {
    this.startCall = { when, offset, duration };
  }

  stop() {
    this.stopped = true;
  }
}

class FakeAudioContext {
  currentTime = 0;
  state: AudioContextState = "running";
  sampleRate = SAMPLE_RATE;
  destination = {} as AudioDestinationNode;
  sources: FakeBufferSource[] = [];
  closed = false;

  createGain() {
    return new FakeGainNode() as unknown as GainNode;
  }

  createBufferSource() {
    const source = new FakeBufferSource();
    this.sources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }

  createMediaStreamSource(_stream: MediaStream) {
    return {
      connect: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as MediaStreamAudioSourceNode;
  }

  createScriptProcessor(_bufferSize: number, _inputChannels: number, _outputChannels: number) {
    const processor = {
      onaudioprocess: null as ((event: AudioProcessingEvent) => void) | null,
      connect: jest.fn(),
      disconnect: jest.fn(),
    };
    return processor as unknown as ScriptProcessorNode;
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    const channelData = Array.from({ length: channels }, () => new Float32Array(length));
    return {
      length,
      duration: length / sampleRate,
      numberOfChannels: channels,
      sampleRate,
      copyToChannel(source: Float32Array, channelNumber: number) {
        channelData[channelNumber]?.set(source);
      },
      getChannelData(channelNumber: number) {
        return channelData[channelNumber] ?? new Float32Array(0);
      },
    } as unknown as AudioBuffer;
  }

  decodeAudioData(_data: ArrayBuffer): Promise<AudioBuffer> {
    return Promise.resolve({ duration: 1 } as AudioBuffer);
  }

  resume() {
    this.state = "running";
    return Promise.resolve();
  }

  close() {
    this.closed = true;
    return Promise.resolve();
  }
}

const SAMPLE_RATE = 44_100;

function makeEngine() {
  const ctx = new FakeAudioContext();
  const engine = new AudioEngine({ contextFactory: () => ctx as unknown as AudioContext });
  return { ctx, engine };
}

/**
 * Minimal `MediaRecorder` stand-in: jsdom has none. Tests drive its lifecycle
 * (`start`/`stop`) and fire the matching events so the engine's recording
 * promises resolve like they would in a browser.
 */
class FakeMediaRecorder {
  mimeType: string;
  onstart: (() => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  started = false;
  stopped = false;

  constructor(
    public stream: MediaStream,
    options?: MediaRecorderOptions,
  ) {
    this.mimeType = options?.mimeType ?? "";
  }

  start() {
    this.started = true;
    this.onstart?.();
  }

  stop() {
    this.stopped = true;
    this.ondataavailable?.({ data: new Blob(["audio"], { type: "audio/webm" }) });
    this.onstop?.();
  }
}

function makeRecordingEngine(options: { onMediaStreamRequest?: () => void } = {}) {
  const ctx = new FakeAudioContext();
  const tracks = [{ stop: jest.fn() }];
  const stream = { getTracks: () => tracks } as unknown as MediaStream;
  const recorders: FakeMediaRecorder[] = [];
  const recordingProcessors: Array<{
    onaudioprocess: ((event: AudioProcessingEvent) => void) | null;
  }> = [];
  const engine = new AudioEngine({
    contextFactory: () => ctx as unknown as AudioContext,
    mediaStreamProvider: () => {
      options.onMediaStreamRequest?.();
      return Promise.resolve(stream);
    },
    mediaRecorderFactory: (s, options) => {
      const recorder = new FakeMediaRecorder(s, options);
      recorders.push(recorder);
      return recorder as unknown as MediaRecorder;
    },
  });
  const originalCreateScriptProcessor = ctx.createScriptProcessor.bind(ctx);
  ctx.createScriptProcessor = (...args) => {
    const processor = originalCreateScriptProcessor(...args) as unknown as {
      onaudioprocess: ((event: AudioProcessingEvent) => void) | null;
    };
    recordingProcessors.push(processor);
    return processor as unknown as ScriptProcessorNode;
  };
  return { ctx, engine, recorders, tracks, recordingProcessors };
}

function stateWith(overrides: Partial<AudioEngineState> = {}): AudioEngineState {
  return {
    clips: [],
    sampleRate: SAMPLE_RATE,
    playStart: 0,
    playEnd: 0,
    loop: false,
    ...overrides,
  };
}

function flatClip(
  clip: Pick<AudioEngineClip, "id" | "audioId" | "start" | "duration"> & {
    audioOffset?: number;
  },
): AudioEngineClip {
  const audioOffset = clip.audioOffset ?? 0;
  return {
    id: clip.id,
    audioId: clip.audioId,
    start: clip.start,
    duration: clip.duration,
    audioInClips: [
      { start: clip.start, duration: clip.duration, audioOffset },
    ],
  };
}

function stackedClip(
  clip: Pick<AudioEngineClip, "id" | "audioId" | "start" | "duration"> & {
    loopLength: number;
    passes: number;
    audioOffset?: number;
  },
): AudioEngineClip {
  const baseOffset = clip.audioOffset ?? 0;
  return {
    id: clip.id,
    audioId: clip.audioId,
    start: clip.start,
    duration: clip.duration,
    audioInClips: Array.from({ length: clip.passes }, (_, k) => ({
      start: clip.start,
      duration: clip.duration,
      audioOffset: baseOffset + k * clip.loopLength,
    })),
  };
}

const fakeBuffer = { duration: 2 } as AudioBuffer;

describe("AudioEngine", () => {
  it("starts not playing with a zero timecode", () => {
    const { engine } = makeEngine();
    expect(engine.isPlaying).toBe(false);
    expect(engine.timecode).toBe(0);
    expect(engine.audioEvents).toEqual([]);
  });

  it("derives an audio event per clip on update", () => {
    const { engine } = makeEngine();
    engine.update(
      stateWith({
        clips: [
          flatClip({ id: "c1", audioId: "a1", start: 100, duration: 50, audioOffset: 10 }),
          flatClip({ id: "c2", audioId: "a2", start: 200, duration: 25 }),
        ],
      }),
    );

    expect(engine.audioEvents).toEqual([
      { clipId: "c1", audioId: "a1", startSample: 100, endSample: 150, bufferOffset: 10 },
      { clipId: "c2", audioId: "a2", startSample: 200, endSample: 225, bufferOffset: 0 },
    ]);
  });

  it("overlays a stacked clip's recorded loop passes within its loop region", () => {
    const { engine } = makeEngine();
    engine.update(
      stateWith({
        clips: [
          stackedClip({
            id: "c1",
            audioId: "a1",
            start: 0,
            duration: SAMPLE_RATE,
            loopLength: SAMPLE_RATE,
            passes: 3,
          }),
        ],
      }),
    );

    expect(engine.audioEvents).toEqual([
      { clipId: "c1", audioId: "a1", startSample: 0, endSample: SAMPLE_RATE, bufferOffset: 0 },
      { clipId: "c1", audioId: "a1", startSample: 0, endSample: SAMPLE_RATE, bufferOffset: SAMPLE_RATE },
      { clipId: "c1", audioId: "a1", startSample: 0, endSample: SAMPLE_RATE, bufferOffset: 2 * SAMPLE_RATE },
    ]);
  });

  it("truncates audio events at the clip envelope when the clip is trimmed shorter", () => {
    const { engine } = makeEngine();
    engine.update(
      stateWith({
        clips: [
          {
            id: "c1",
            audioId: "a1",
            start: 0,
            duration: SAMPLE_RATE / 2,
            audioInClips: [
              { start: 0, duration: SAMPLE_RATE, audioOffset: 0 },
              { start: 0, duration: SAMPLE_RATE, audioOffset: SAMPLE_RATE },
            ],
          },
        ],
      }),
    );

    expect(engine.audioEvents).toEqual([
      { clipId: "c1", audioId: "a1", startSample: 0, endSample: SAMPLE_RATE / 2, bufferOffset: 0 },
      { clipId: "c1", audioId: "a1", startSample: 0, endSample: SAMPLE_RATE / 2, bufferOffset: SAMPLE_RATE },
    ]);
  });

  it("cues the timecode to playStart while stopped", () => {
    const { engine } = makeEngine();
    engine.update(stateWith({ playStart: 5_000 }));
    expect(engine.timecode).toBe(5_000);
  });

  it("schedules a source per loaded clip when playback begins", () => {
    const { ctx, engine } = makeEngine();
    engine.setAudioBuffer("a1", fakeBuffer);
    engine.update(
      stateWith({
        playStart: 0,
        clips: [flatClip({ id: "c1", audioId: "a1", start: SAMPLE_RATE, duration: SAMPLE_RATE })],
      }),
    );

    engine.play();

    expect(engine.isPlaying).toBe(true);
    expect(ctx.sources).toHaveLength(1);
    const call = ctx.sources[0].startCall;
    // Clip starts one second (SAMPLE_RATE samples) after playStart.
    expect(call?.when).toBeCloseTo(1);
    expect(call?.offset).toBeCloseTo(0);
    expect(call?.duration).toBeCloseTo(1);
  });

  it("schedules an overlaid source per recorded loop pass for a stacked clip", () => {
    const { ctx, engine } = makeEngine();
    engine.setAudioBuffer("a1", { duration: 2 } as AudioBuffer);
    const loopLength = SAMPLE_RATE;
    engine.update(
      stateWith({
        playStart: 0,
        clips: [
          stackedClip({
            id: "c1",
            audioId: "a1",
            start: 0,
            duration: loopLength,
            loopLength,
            passes: 2,
          }),
        ],
      }),
    );

    engine.play();

    // Both passes begin together at the clip start and last one loop region,
    // each reading a different loop-length slice of the recording.
    expect(ctx.sources).toHaveLength(2);
    expect(ctx.sources[0].startCall?.when).toBeCloseTo(0);
    expect(ctx.sources[0].startCall?.offset).toBeCloseTo(0);
    expect(ctx.sources[0].startCall?.duration).toBeCloseTo(1);
    expect(ctx.sources[1].startCall?.when).toBeCloseTo(0);
    expect(ctx.sources[1].startCall?.offset).toBeCloseTo(1);
    expect(ctx.sources[1].startCall?.duration).toBeCloseTo(1);
  });

  it("skips clips whose audio is not loaded", () => {
    const { ctx, engine } = makeEngine();
    engine.update(stateWith({ clips: [flatClip({ id: "c1", audioId: "missing", start: 0, duration: 100 })] }));
    engine.play();
    expect(ctx.sources).toHaveLength(0);
  });

  it("starts mid-clip immediately with a buffer offset when playStart is inside a clip", () => {
    const { ctx, engine } = makeEngine();
    engine.setAudioBuffer("a1", fakeBuffer);
    engine.update(
      stateWith({
        playStart: SAMPLE_RATE, // half a second into the clip below
        clips: [flatClip({ id: "c1", audioId: "a1", start: SAMPLE_RATE / 2, duration: SAMPLE_RATE * 4 })],
      }),
    );

    engine.play();

    const call = ctx.sources[0].startCall;
    expect(call?.when).toBeCloseTo(0); // plays right away
    // Offset into the buffer is the half-second already elapsed within the clip.
    expect(call?.offset).toBeCloseTo(0.5);
  });

  it("reports an advancing timecode from the audio clock while playing", () => {
    const { ctx, engine } = makeEngine();
    engine.update(stateWith({ playStart: 1_000 }));
    engine.play();

    expect(engine.timecode).toBe(1_000);
    ctx.currentTime += 2; // two seconds of audio-clock time
    expect(engine.timecode).toBeCloseTo(1_000 + 2 * SAMPLE_RATE);
  });

  it("clamps the reported timecode to playEnd while looping", () => {
    const { ctx, engine } = makeEngine();
    engine.update(stateWith({ playStart: 0, playEnd: SAMPLE_RATE, loop: true }));
    engine.play();

    ctx.currentTime += 5; // way past the one-second loop region
    expect(engine.timecode).toBe(SAMPLE_RATE);
  });

  it("does not bound the timecode at playEnd when not looping", () => {
    const { ctx, engine } = makeEngine();
    engine.update(stateWith({ playStart: 0, playEnd: SAMPLE_RATE, loop: false }));
    engine.play();

    ctx.currentTime += 5; // playEnd is ignored without looping
    expect(engine.timecode).toBeCloseTo(5 * SAMPLE_RATE);
  });

  it("freezes the timecode where it stopped and stops sources", () => {
    const { ctx, engine } = makeEngine();
    engine.setAudioBuffer("a1", fakeBuffer);
    engine.update(stateWith({ clips: [flatClip({ id: "c1", audioId: "a1", start: 0, duration: SAMPLE_RATE * 10 })] }));
    engine.play();

    ctx.currentTime += 1;
    engine.stop();

    expect(engine.isPlaying).toBe(false);
    expect(engine.timecode).toBeCloseTo(SAMPLE_RATE);
    expect(ctx.sources[0].stopped).toBe(true);
  });

  it("notifies subscribers when playing state flips", () => {
    const { engine } = makeEngine();
    const listener = jest.fn();
    engine.subscribe(listener);

    engine.update(stateWith());
    engine.play();
    engine.stop();

    expect(listener).toHaveBeenNthCalledWith(1, true);
    expect(listener).toHaveBeenNthCalledWith(2, false);
  });

  it("does not stop at playEnd when not looping (plays indefinitely)", () => {
    jest.useFakeTimers();
    try {
      const { ctx, engine } = makeEngine();
      const listener = jest.fn();
      engine.subscribe(listener);
      engine.update(stateWith({ playStart: 0, playEnd: SAMPLE_RATE, loop: false }));
      engine.play();

      // No loop timer is armed, so advancing the clock/timers keeps playing.
      ctx.currentTime += 5;
      jest.advanceTimersByTime(5_000);

      expect(engine.isPlaying).toBe(true);
      expect(engine.timecode).toBeCloseTo(5 * SAMPLE_RATE);
      // Only the initial play flipped the listener; no auto-stop occurred.
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenLastCalledWith(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it("loops back to playStart at playEnd instead of stopping when looping", () => {
    jest.useFakeTimers();
    try {
      const { ctx, engine } = makeEngine();
      const listener = jest.fn();
      engine.subscribe(listener);
      engine.update(stateWith({ playStart: 0, playEnd: SAMPLE_RATE, loop: true }));
      engine.play();

      ctx.currentTime += 1;
      jest.advanceTimersByTime(1_000);

      // Still playing, re-anchored to playStart for the next loop.
      expect(engine.isPlaying).toBe(true);
      expect(engine.timecode).toBeCloseTo(0);
      // Only the initial play flipped the listener; the loop did not stop.
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenLastCalledWith(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it("re-schedules from the current position when updated mid-playback", () => {
    const { ctx, engine } = makeEngine();
    engine.setAudioBuffer("a1", fakeBuffer);
    engine.update(stateWith({ clips: [flatClip({ id: "c1", audioId: "a1", start: 0, duration: SAMPLE_RATE * 10 })] }));
    engine.play();

    ctx.currentTime += 1;
    const playheadBefore = engine.timecode;

    // Add a second clip while playing; the engine should reschedule.
    engine.setAudioBuffer("a2", fakeBuffer);
    engine.update(
      stateWith({
        clips: [
          flatClip({ id: "c1", audioId: "a1", start: 0, duration: SAMPLE_RATE * 10 }),
          flatClip({ id: "c2", audioId: "a2", start: 0, duration: SAMPLE_RATE * 10 }),
        ],
      }),
    );

    expect(engine.isPlaying).toBe(true);
    expect(engine.audioEvents).toHaveLength(2);
    // Timecode is preserved across the reschedule.
    expect(engine.timecode).toBeCloseTo(playheadBefore);
    // The first run's source was stopped; two fresh sources were scheduled.
    expect(ctx.sources[0].stopped).toBe(true);
    expect(ctx.sources.filter((s) => !s.stopped)).toHaveLength(2);
  });

  it("decodes and stores audio via loadAudio", async () => {
    const { engine } = makeEngine();
    await engine.loadAudio("a1", new ArrayBuffer(8));
    expect(engine.hasAudio("a1")).toBe(true);
  });

  it("anchors a recording's startSample to the current timecode", async () => {
    const { engine } = makeRecordingEngine();
    engine.update(stateWith({ playStart: 5_000 }));

    const { startSample } = await engine.startRecording();

    // While stopped the timecode is cued to playStart, so that's the anchor.
    expect(startSample).toBe(5_000);
    expect(engine.isRecording).toBe(true);
  });

  it("starts playback in the same instant capture begins with startPlayback", async () => {
    const { ctx, engine } = makeRecordingEngine();
    engine.update(stateWith({ playStart: 5_000 }));

    const { startSample } = await engine.startRecording({ startPlayback: true });

    // Capture and the transport share one anchor: playing flipped on, and the
    // recording's startSample matches the playhead's start (playStart).
    expect(engine.isPlaying).toBe(true);
    expect(engine.isRecording).toBe(true);
    expect(startSample).toBe(5_000);
    expect(engine.timecode).toBeCloseTo(5_000);

    // The recorded duration tracks the playhead exactly (no lead-in drift).
    ctx.currentTime += 2;
    expect(engine.timecode).toBeCloseTo(5_000 + 2 * SAMPLE_RATE);
    const result = await engine.stopRecording();
    expect(result.durationSamples).toBeCloseTo(2 * SAMPLE_RATE);
  });

  it("does not restart playback for startPlayback when already playing", async () => {
    const { ctx, engine } = makeRecordingEngine();
    engine.update(stateWith({ playStart: 0 }));
    engine.play();
    ctx.currentTime += 1; // one second elapsed → SAMPLE_RATE samples

    const { startSample } = await engine.startRecording({ startPlayback: true });

    // Already playing: the live playhead anchors the take rather than resetting.
    expect(startSample).toBeCloseTo(SAMPLE_RATE);
    expect(engine.isPlaying).toBe(true);
  });

  it("captures the live playhead as startSample when recording while playing", async () => {
    const { ctx, engine } = makeRecordingEngine();
    engine.update(stateWith({ playStart: 0 }));
    engine.play();
    ctx.currentTime += 1; // one second elapsed → SAMPLE_RATE samples

    const { startSample } = await engine.startRecording();

    expect(startSample).toBeCloseTo(SAMPLE_RATE);
  });

  it("reports duration in timeline samples from the audio clock on stop", async () => {
    const { ctx, engine } = makeRecordingEngine();
    engine.update(stateWith({ playStart: 1_000 }));

    await engine.startRecording();
    ctx.currentTime += 2; // two seconds of capture
    const result = await engine.stopRecording();

    expect(result.startSample).toBe(1_000);
    expect(result.durationSamples).toBeCloseTo(2 * SAMPLE_RATE);
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.contentType).toBeTruthy();
    expect(engine.isRecording).toBe(false);
  });

  it("captures loopLength when recording with looping transport", async () => {
    const { ctx, engine } = makeRecordingEngine();
    engine.update(stateWith({ playStart: 0, playEnd: SAMPLE_RATE, loop: true }));

    const { loopLength } = await engine.startRecording({ startPlayback: true });
    ctx.currentTime += 2;
    const result = await engine.stopRecording();

    expect(loopLength).toBe(SAMPLE_RATE);
    expect(result.loopLength).toBe(SAMPLE_RATE);
  });

  it("omits loopLength when not looping", async () => {
    const { ctx, engine } = makeRecordingEngine();
    engine.update(stateWith({ playStart: 0, playEnd: SAMPLE_RATE, loop: false }));

    const { loopLength } = await engine.startRecording();
    ctx.currentTime += 1;
    const result = await engine.stopRecording();

    expect(loopLength).toBeUndefined();
    expect(result.loopLength).toBeUndefined();
  });

  it("measures capture length on the audio clock independent of playhead wrap", async () => {
    const { ctx, engine } = makeRecordingEngine();
    engine.update(stateWith({ playStart: 0, playEnd: SAMPLE_RATE, loop: true }));

    await engine.startRecording({ startPlayback: true });
    ctx.currentTime += 1;
    expect(engine.getRecordingCapturedSamples()).toBeCloseTo(SAMPLE_RATE);
    expect(engine.timecode).toBeCloseTo(SAMPLE_RATE);

    // Loop wrap: playhead jumps back to playStart while capture continues.
    (engine as unknown as { handleEnded(): void }).handleEnded();
    expect(engine.hasRecordingCrossedLoop()).toBe(true);
    ctx.currentTime += 0.25;
    expect(engine.timecode).toBeCloseTo(0.25 * SAMPLE_RATE);
    expect(engine.getRecordingCapturedSamples()).toBeCloseTo(1.25 * SAMPLE_RATE);

    // Playhead passes the recording start again — latch must keep placement.
    ctx.currentTime += 0.75;
    expect(engine.timecode).toBeCloseTo(SAMPLE_RATE);
    expect(engine.hasRecordingCrossedLoop()).toBe(true);

    const result = await engine.stopRecording();
    expect(result.crossedLoopBoundary).toBe(true);
  });

  it("exposes live PCM through getRecordingBuffer while recording", async () => {
    const { engine, recordingProcessors } = makeRecordingEngine();
    engine.update(stateWith());

    await engine.startRecording();
    expect(engine.getRecordingBuffer()).toBeUndefined();

    const samples = new Float32Array(128).fill(0.5);
    recordingProcessors[0]?.onaudioprocess?.({
      inputBuffer: {
        getChannelData: () => samples,
      },
    } as unknown as AudioProcessingEvent);

    const first = engine.getRecordingBuffer();
    expect(first?.length).toBe(128);
    expect(engine.getRecordingBuffer()).toBe(first);

    await engine.stopRecording();
    expect(engine.getRecordingBuffer()).toBeUndefined();
  });

  it("releases the microphone tracks when a recording stops", async () => {
    const { ctx, engine, tracks } = makeRecordingEngine();
    engine.update(stateWith());

    await engine.startRecording();
    ctx.currentTime += 1;
    await engine.stopRecording();

    expect(tracks[0].stop).toHaveBeenCalled();
  });

  it("rejects starting a second recording while one is in progress", async () => {
    const { engine } = makeRecordingEngine();
    engine.update(stateWith());
    await engine.startRecording();
    await expect(engine.startRecording()).rejects.toThrow(/already in progress/);
  });

  it("rejects stopRecording when nothing is being captured", async () => {
    const { engine } = makeRecordingEngine();
    engine.update(stateWith());
    await expect(engine.stopRecording()).rejects.toThrow(/No recording/);
  });

  it("propagates microphone-acquisition failures from startRecording", async () => {
    const ctx = new FakeAudioContext();
    const engine = new AudioEngine({
      contextFactory: () => ctx as unknown as AudioContext,
      mediaStreamProvider: () =>
        Promise.reject(new DOMException("denied", "NotAllowedError")),
    });
    engine.update(stateWith());
    await expect(engine.startRecording()).rejects.toThrow(/denied/);
    expect(engine.isRecording).toBe(false);
  });

  it("reuses a prepared microphone stream on startRecording", async () => {
    let providerCalls = 0;
    const { ctx, engine } = makeRecordingEngine({
      onMediaStreamRequest: () => {
        providerCalls += 1;
      },
    });
    engine.update(stateWith());

    await engine.prepareRecording();
    await engine.startRecording();

    expect(providerCalls).toBe(1);
    expect(engine.isRecording).toBe(true);
    ctx.currentTime += 1;
    await engine.stopRecording();
  });

  it("discards a prepared stream when the input device changes", async () => {
    let providerCalls = 0;
    const { engine } = makeRecordingEngine({
      onMediaStreamRequest: () => {
        providerCalls += 1;
      },
    });
    engine.update(stateWith());

    await engine.prepareRecording();
    engine.setInputDeviceId("other-mic");
    await engine.prepareRecording();

    expect(providerCalls).toBe(2);
  });

  it("does not prepare a stream while a recording is active", async () => {
    let providerCalls = 0;
    const { ctx, engine } = makeRecordingEngine({
      onMediaStreamRequest: () => {
        providerCalls += 1;
      },
    });
    engine.update(stateWith());

    await engine.startRecording();
    await engine.prepareRecording();

    expect(providerCalls).toBe(1);
    ctx.currentTime += 1;
    await engine.stopRecording();
  });

  it("releases the context on dispose", async () => {
    const { ctx, engine } = makeEngine();
    engine.setAudioBuffer("a1", fakeBuffer);
    engine.update(stateWith());
    engine.play();
    engine.dispose();
    expect(ctx.closed).toBe(true);
    expect(engine.isPlaying).toBe(false);
  });
});
