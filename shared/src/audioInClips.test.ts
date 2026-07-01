import {
  backfillAudioInClips,
  deriveAudioInClips,
  deriveLiveRecordingAudioInClips,
  flattenAudioInClips,
  resolveScheduledEvent,
  shiftAudioInClips,
  stackedLayerCount,
  validateAudioInClips,
} from "./audioInClips";

const LOOP = 96_000;
const HALF = 48_000;
const QUARTER = 24_000;

describe("stackedLayerCount", () => {
  it("returns at least one", () => {
    expect(stackedLayerCount(100, LOOP)).toBe(1);
  });

  it("rounds recorded length divided by loop length", () => {
    expect(stackedLayerCount(LOOP * 2, LOOP)).toBe(2);
    expect(stackedLayerCount(LOOP * 2 + HALF, LOOP)).toBe(3);
  });
});

describe("deriveAudioInClips", () => {
  it("creates one spec for FLAT clips", () => {
    expect(
      deriveAudioInClips({
        mode: "FLAT",
        clipStart: 100,
        clipDuration: 500,
        clipAudioOffset: 10,
        recordedSamples: 500,
      }),
    ).toEqual([{ start: 100, duration: 500, audioOffset: 10 }]);
  });

  it("creates stacked layers with spaced audio offsets", () => {
    expect(
      deriveAudioInClips({
        mode: "STACKED",
        clipStart: 0,
        clipDuration: LOOP,
        clipAudioOffset: 0,
        loopLength: LOOP,
        recordedSamples: LOOP * 2,
      }),
    ).toEqual([
      { start: 0, duration: LOOP, audioOffset: 0 },
      { start: 0, duration: LOOP, audioOffset: LOOP },
    ]);
  });
});

describe("deriveLiveRecordingAudioInClips", () => {
  it("returns null before the loop boundary is crossed", () => {
    expect(
      deriveLiveRecordingAudioInClips({
        startSample: QUARTER,
        capturedSamples: HALF,
        loopLength: LOOP,
        playStart: 0,
        crossedLoopBoundary: false,
      }),
    ).toBeNull();
  });

  it("derives stacked specs after wrap", () => {
    const specs = deriveLiveRecordingAudioInClips({
      startSample: HALF + QUARTER,
      capturedSamples: LOOP * 2,
      loopLength: LOOP,
      playStart: 0,
      crossedLoopBoundary: true,
    });
    expect(specs).toHaveLength(2);
    expect(specs![0]).toMatchObject({ start: 0, duration: LOOP, audioOffset: 0 });
    expect(specs![1]).toMatchObject({ start: 0, duration: LOOP, audioOffset: LOOP });
  });
});

describe("resolveScheduledEvent", () => {
  const aic = { start: 1000, duration: LOOP, audioOffset: 500 };

  it("passes through when the clip envelope matches", () => {
    expect(resolveScheduledEvent(aic, { start: 1000, duration: LOOP })).toEqual({
      startSample: 1000,
      endSample: 1000 + LOOP,
      bufferOffset: 500,
    });
  });

  it("truncates at the clip end when the clip is shorter", () => {
    expect(resolveScheduledEvent(aic, { start: 1000, duration: HALF })).toEqual({
      startSample: 1000,
      endSample: 1000 + HALF,
      bufferOffset: 500,
    });
  });

  it("advances buffer offset when the clip start cuts into the AudioInClip", () => {
    expect(resolveScheduledEvent(aic, { start: 1000 + QUARTER, duration: HALF })).toEqual({
      startSample: 1000 + QUARTER,
      endSample: 1000 + QUARTER + HALF,
      bufferOffset: 500 + QUARTER,
    });
  });

  it("returns null when fully outside the envelope", () => {
    expect(resolveScheduledEvent(aic, { start: 200_000, duration: 1000 })).toBeNull();
  });
});

describe("flattenAudioInClips", () => {
  it("truncates stacked layers at a trimmed clip end", () => {
    const events = flattenAudioInClips([
      {
        id: "clip-1",
        audioId: "audio-1",
        start: 0,
        duration: HALF,
        audioInClips: [
          { start: 0, duration: LOOP, audioOffset: 0 },
          { start: 0, duration: LOOP, audioOffset: LOOP },
        ],
      },
    ]);
    expect(events).toHaveLength(2);
    expect(events[0]!.endSample).toBe(HALF);
    expect(events[1]!.endSample).toBe(HALF);
  });
});

describe("validateAudioInClips", () => {
  it("accepts a valid FLAT clip", () => {
    expect(() =>
      validateAudioInClips(
        [{ start: 0, duration: 1000, audioOffset: 0 }],
        { start: 0, duration: 1000, audioOffset: 0, mode: "FLAT" },
      ),
    ).not.toThrow();
  });

  it("rejects mismatched STACKED offsets", () => {
    expect(() =>
      validateAudioInClips(
        [
          { start: 0, duration: LOOP, audioOffset: 0 },
          { start: 0, duration: LOOP, audioOffset: 1 },
        ],
        { start: 0, duration: LOOP, audioOffset: 0, mode: "STACKED" },
        LOOP,
      ),
    ).toThrow(/audioOffset/);
  });
});

describe("shiftAudioInClips", () => {
  it("shifts every start by the delta", () => {
    expect(
      shiftAudioInClips([{ start: 100, duration: 50, audioOffset: 0 }], 500),
    ).toEqual([{ start: 600, duration: 50, audioOffset: 0 }]);
  });
});

describe("backfillAudioInClips", () => {
  it("synthesizes a single FLAT spec", () => {
    expect(
      backfillAudioInClips({
        start: 10,
        duration: 100,
        audioOffset: 5,
        mode: "FLAT",
      }),
    ).toEqual([{ start: 10, duration: 100, audioOffset: 5 }]);
  });
});
