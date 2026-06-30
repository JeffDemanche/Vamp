import {
  clipPlacementFromRecording,
  recordingClipDisplay,
} from "./RecordingController"
import {
  finalizeWrappedRecordingPcm,
  recordingClipLayout,
  recordingCrossedLoopBoundary,
  remapFirstPassToLoopRegion,
} from "@/audio/recordingClipLayout"

const LOOP = 96_000
const HALF = 48_000
const QUARTER = 24_000

describe("recordingCrossedLoopBoundary", () => {
  it("is false without a loop length", () => {
    expect(recordingCrossedLoopBoundary(HALF, QUARTER)).toBe(false)
  })

  it("is true when the stop playhead wrapped below the start", () => {
    expect(recordingCrossedLoopBoundary(HALF + QUARTER, QUARTER, LOOP)).toBe(true)
  })

  it("is false when the take stays within one loop traversal", () => {
    expect(recordingCrossedLoopBoundary(QUARTER, HALF + QUARTER, LOOP)).toBe(false)
  })
})

describe("recordingClipLayout", () => {
  it("creates a flat clip for non-looped takes", () => {
    expect(
      recordingClipLayout({ startSample: 0, capturedSamples: LOOP }),
    ).toEqual({
      start: 0,
      duration: LOOP,
      mode: "FLAT",
      wrapped: false,
    })
  })

  it("keeps a partial looped take at its start when the loop was not crossed", () => {
    expect(
      recordingClipLayout({
        startSample: QUARTER,
        capturedSamples: HALF,
        loopLength: LOOP,
        playStart: 0,
        stopSample: QUARTER + HALF,
      }),
    ).toEqual({
      start: QUARTER,
      duration: HALF,
      mode: "STACKED",
      loopLength: LOOP,
      wrapped: false,
    })
  })

  it("anchors at playStart across the full loop when the boundary was crossed", () => {
    expect(
      recordingClipLayout({
        startSample: HALF + QUARTER,
        capturedSamples: HALF,
        loopLength: LOOP,
        playStart: 0,
        stopSample: QUARTER,
      }),
    ).toEqual({
      start: 0,
      duration: LOOP,
      mode: "STACKED",
      loopLength: LOOP,
      wrapped: true,
    })
  })

  it("locks to loop length once a full pass is captured without crossing", () => {
    expect(
      recordingClipLayout({
        startSample: QUARTER,
        capturedSamples: LOOP,
        loopLength: LOOP,
        playStart: 0,
        stopSample: QUARTER,
      }),
    ).toEqual({
      start: QUARTER,
      duration: LOOP,
      mode: "STACKED",
      loopLength: LOOP,
      wrapped: false,
    })
  })

  it("stays at playStart when latched even after the playhead passes startSample again", () => {
    expect(
      recordingClipLayout({
        startSample: HALF + QUARTER,
        capturedSamples: LOOP * 2,
        loopLength: LOOP,
        playStart: 0,
        stopSample: HALF + QUARTER,
        crossedLoopBoundary: true,
      }),
    ).toEqual({
      start: 0,
      duration: LOOP,
      mode: "STACKED",
      loopLength: LOOP,
      wrapped: true,
    })
  })
})

describe("remapFirstPassToLoopRegion", () => {
  it("maps pre- and post-wrap audio into loop coordinates", () => {
    const chronological = new Float32Array(HALF)
    chronological.fill(1, 0, QUARTER)
    chronological.fill(2, QUARTER, HALF)

    const remapped = remapFirstPassToLoopRegion(chronological, {
      startSample: HALF + QUARTER,
      playStart: 0,
      loopLength: LOOP,
    })

    expect(remapped.length).toBe(LOOP)
    expect(remapped[0]).toBe(2)
    expect(remapped[QUARTER - 1]).toBe(2)
    expect(remapped[HALF + QUARTER]).toBe(1)
    expect(remapped[LOOP - 1]).toBe(1)
    expect(remapped[QUARTER]).toBe(0)
  })
})

describe("finalizeWrappedRecordingPcm", () => {
  it("remaps the first pass and appends later passes unchanged", () => {
    const firstPass = new Float32Array(LOOP)
    firstPass.fill(3)
    const secondPass = new Float32Array(LOOP)
    secondPass.fill(4)
    const chronological = new Float32Array(LOOP * 2)
    chronological.set(firstPass, 0)
    chronological.set(secondPass, LOOP)

    const out = finalizeWrappedRecordingPcm(chronological, {
      startSample: HALF + QUARTER,
      playStart: 0,
      loopLength: LOOP,
    })

    expect(out.length).toBe(LOOP * 2)
    expect(out[LOOP]).toBe(4)
    expect(out[LOOP * 2 - 1]).toBe(4)
  })
})

describe("recordingClipDisplay", () => {
  it("creates a flat clip for non-looped takes", () => {
    expect(recordingClipDisplay(LOOP)).toEqual({
      duration: LOOP,
      mode: "FLAT",
    })
  })

  it("uses loop length once the first loop point is reached", () => {
    expect(recordingClipDisplay(LOOP * 2, LOOP)).toEqual({
      duration: LOOP,
      mode: "STACKED",
      loopLength: LOOP,
    })
  })

  it("uses captured length when a looped take stops before the first loop point", () => {
    expect(recordingClipDisplay(QUARTER, LOOP)).toEqual({
      duration: QUARTER,
      mode: "STACKED",
      loopLength: LOOP,
    })
  })
})

describe("clipPlacementFromRecording", () => {
  it("creates a flat clip for non-looped takes", () => {
    expect(
      clipPlacementFromRecording({
        durationSamples: LOOP,
        startSample: 0,
        stopSample: LOOP,
        playStart: 0,
        crossedLoopBoundary: false,
      }),
    ).toEqual({
      start: 0,
      duration: LOOP,
      mode: "FLAT",
      wrapped: false,
    })
  })

  it("uses loop length once the first loop point is reached", () => {
    expect(
      clipPlacementFromRecording({
        durationSamples: LOOP * 2,
        loopLength: LOOP,
        startSample: 0,
        stopSample: 0,
        playStart: 0,
        crossedLoopBoundary: false,
      }),
    ).toEqual({
      start: 0,
      duration: LOOP,
      mode: "STACKED",
      loopLength: LOOP,
      wrapped: false,
    })
  })

  it("uses captured length when a looped take stops before the first loop point", () => {
    expect(
      clipPlacementFromRecording({
        durationSamples: QUARTER,
        loopLength: LOOP,
        startSample: QUARTER,
        stopSample: HALF,
        playStart: 0,
        crossedLoopBoundary: false,
      }),
    ).toEqual({
      start: QUARTER,
      duration: QUARTER,
      mode: "STACKED",
      loopLength: LOOP,
      wrapped: false,
    })
  })

  it("spans the full loop when the take crossed the boundary", () => {
    expect(
      clipPlacementFromRecording({
        durationSamples: HALF,
        loopLength: LOOP,
        startSample: HALF + QUARTER,
        stopSample: QUARTER,
        playStart: 0,
        crossedLoopBoundary: true,
      }),
    ).toEqual({
      start: 0,
      duration: LOOP,
      mode: "STACKED",
      loopLength: LOOP,
      wrapped: true,
    })
  })

  it("prefers the latched flag over stopSample when the playhead has caught up", () => {
    expect(
      clipPlacementFromRecording({
        durationSamples: LOOP * 2,
        loopLength: LOOP,
        startSample: HALF + QUARTER,
        stopSample: HALF + QUARTER,
        playStart: 0,
        crossedLoopBoundary: true,
      }),
    ).toEqual({
      start: 0,
      duration: LOOP,
      mode: "STACKED",
      loopLength: LOOP,
      wrapped: true,
    })
  })
})
