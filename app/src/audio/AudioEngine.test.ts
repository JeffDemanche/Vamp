import { AudioEngine, type AudioEngineState } from "./AudioEngine";

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
          { id: "c1", audioId: "a1", start: 100, duration: 50, offset: 10 },
          { id: "c2", audioId: "a2", start: 200, duration: 25 },
        ],
      }),
    );

    expect(engine.audioEvents).toEqual([
      { clipId: "c1", audioId: "a1", startSample: 100, endSample: 150, bufferOffset: 10 },
      { clipId: "c2", audioId: "a2", startSample: 200, endSample: 225, bufferOffset: 0 },
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
        clips: [{ id: "c1", audioId: "a1", start: SAMPLE_RATE, duration: SAMPLE_RATE }],
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

  it("skips clips whose audio is not loaded", () => {
    const { ctx, engine } = makeEngine();
    engine.update(stateWith({ clips: [{ id: "c1", audioId: "missing", start: 0, duration: 100 }] }));
    engine.play();
    expect(ctx.sources).toHaveLength(0);
  });

  it("starts mid-clip immediately with a buffer offset when playStart is inside a clip", () => {
    const { ctx, engine } = makeEngine();
    engine.setAudioBuffer("a1", fakeBuffer);
    engine.update(
      stateWith({
        playStart: SAMPLE_RATE, // half a second into the clip below
        clips: [{ id: "c1", audioId: "a1", start: SAMPLE_RATE / 2, duration: SAMPLE_RATE * 4 }],
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
    engine.update(stateWith({ clips: [{ id: "c1", audioId: "a1", start: 0, duration: SAMPLE_RATE * 10 }] }));
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
    engine.update(stateWith({ clips: [{ id: "c1", audioId: "a1", start: 0, duration: SAMPLE_RATE * 10 }] }));
    engine.play();

    ctx.currentTime += 1;
    const playheadBefore = engine.timecode;

    // Add a second clip while playing; the engine should reschedule.
    engine.setAudioBuffer("a2", fakeBuffer);
    engine.update(
      stateWith({
        clips: [
          { id: "c1", audioId: "a1", start: 0, duration: SAMPLE_RATE * 10 },
          { id: "c2", audioId: "a2", start: 0, duration: SAMPLE_RATE * 10 },
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

  it("releases the context on dispose", () => {
    const { ctx, engine } = makeEngine();
    engine.setAudioBuffer("a1", fakeBuffer);
    engine.update(stateWith());
    engine.play();
    engine.dispose();
    expect(ctx.closed).toBe(true);
    expect(engine.isPlaying).toBe(false);
  });
});
