import {
  clipPlacementFromRecording,
  recordingClipDisplay,
} from "./RecordingController"

describe("recordingClipDisplay", () => {
  it("creates a flat clip for non-looped takes", () => {
    expect(recordingClipDisplay(48_000)).toEqual({
      duration: 48_000,
      mode: "FLAT",
    })
  })

  it("uses loop length once the first loop point is reached", () => {
    expect(recordingClipDisplay(96_000, 48_000)).toEqual({
      duration: 48_000,
      mode: "STACKED",
      loopLength: 48_000,
    })
  })

  it("uses captured length when a looped take stops before the first loop point", () => {
    expect(recordingClipDisplay(12_000, 48_000)).toEqual({
      duration: 12_000,
      mode: "STACKED",
      loopLength: 48_000,
    })
  })
})

describe("clipPlacementFromRecording", () => {
  it("creates a flat clip for non-looped takes", () => {
    expect(
      clipPlacementFromRecording({ durationSamples: 48_000 }),
    ).toEqual({ duration: 48_000, mode: "FLAT" })
  })

  it("uses loop length once the first loop point is reached", () => {
    expect(
      clipPlacementFromRecording({
        durationSamples: 96_000,
        loopLength: 48_000,
      }),
    ).toEqual({ duration: 48_000, mode: "STACKED", loopLength: 48_000 })
  })

  it("uses captured length when a looped take stops before the first loop point", () => {
    expect(
      clipPlacementFromRecording({
        durationSamples: 12_000,
        loopLength: 48_000,
      }),
    ).toEqual({ duration: 12_000, mode: "STACKED", loopLength: 48_000 })
  })
})
