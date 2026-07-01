import { useApolloClient } from "@apollo/client/react"
import * as React from "react"

import {
  useAudioEngine,
  useAudioDevices,
  useAudioEnginePlaying,
} from "@/audio/AudioEngineProvider"
import {
  describeMicrophoneError,
  isMicrophonePermissionDenied,
  queryMicrophonePermission,
  subscribeMicrophonePermission,
  type MicrophonePermission,
} from "@/audio/microphone"
import {
  recordingClipLayout,
  type RecordingClipLayout,
} from "@/audio/recordingClipLayout"
import { logError } from "@/lib/errors"
import { uploadAudioAndCreateClip } from "@/projects/audioUpload"
import { useRecording, useSelectedTrack, useTimelinePlayback } from "@/state/timeline"

/**
 * The recording controls surfaced to the editor UI (the `TimelineToolbar`).
 * Everything the record button needs to render and behave, with the messy bits
 * — mic permissions, audio capture, transport, and clip creation — handled here.
 */
export type RecordingControls = {
  /** Whether a recording is currently in progress. */
  isRecording: boolean;
  /** Whether recording can be armed (a track is selected). */
  canRecord: boolean;
  /** Last known microphone permission, or `null` before the first probe. */
  permission: MicrophonePermission | null;
  /** A user-facing error from the most recent attempt, or `null`. */
  error: string | null;
  /** Arm recording: acquire the mic, start capture, then flip record state on. */
  beginRecording: () => void;
  /** Clear the current error message. */
  dismissError: () => void;
};

const RecordingControlsContext = React.createContext<RecordingControls | null>(
  null,
)

/**
 * Access the editor's {@link RecordingControls}. Throws outside a
 * `RecordingController`.
 */
export function useRecordingControls(): RecordingControls {
  const controls = React.useContext(RecordingControlsContext)
  if (!controls) {
    throw new Error(
      "useRecordingControls must be used within a <RecordingController>",
    )
  }
  return controls
}

export {
  recordingClipDisplay,
  recordingClipLayout,
  type RecordingClipLayout,
} from "@/audio/recordingClipLayout"

/** Timeline placement for a finished take — exported for unit tests. */
export function clipPlacementFromRecording(result: {
  durationSamples: number
  loopLength?: number
  startSample: number
  stopSample: number
  playStart: number
  crossedLoopBoundary: boolean
}): RecordingClipLayout {
  return recordingClipLayout({
    startSample: result.startSample,
    capturedSamples: result.durationSamples,
    loopLength: result.loopLength,
    playStart: result.playStart,
    crossedLoopBoundary: result.crossedLoopBoundary,
    stopSample: result.stopSample,
  })
}

/**
 * Owns the project editor's recording lifecycle and exposes it via
 * {@link useRecordingControls}. Replaces the old headless transport listener:
 * recording is still tied to the transport (any stop ends the take), but this
 * component now also drives the start.
 *
 * - **Permissions.** Probes the microphone permission on mount (no prompt) and
 *   tracks changes, so the toolbar can reflect blocked access ahead of time.
 *   When access is already granted and a track is selected, the engine
 *   pre-acquires the mic (`prepareRecording`) so Record can start capture
 *   without waiting on `getUserMedia`.
 * - **Start.** `beginRecording` flips the jotai recording state immediately so
 *   the live `RecordingClip` and record button react on click, using the current
 *   playhead as a provisional `startSample`. It then acquires the mic and starts
 *   capture; capture starts the engine's playback in the same instant audio
 *   begins (`startPlayback`), so the take and the playhead share one audio-clock
 *   anchor. When capture resolves, the provisional anchor is reconciled if the
 *   playhead moved during mic acquisition (e.g. recording while already playing).
 *   Failures (denied/no mic) roll back the optimistic state and become `error`.
 * - **Finish.** When playback stops while recording, it stops the engine
 *   recording, clears the live recording state (hiding the red `RecordingClip`),
 *   and runs the upload → `createClip` flow with the captured audio, anchored at
 *   the recording's `startSample` for its measured `durationSamples`.
 *
 * Mount inside `TimelineEditor`'s `AudioEngineProvider` and jotai `Provider`.
 */
export function RecordingController({
  projectId,
  children,
}: {
  projectId: string
  children?: React.ReactNode
}) {
  const engine = useAudioEngine()
  const { inputDeviceId } = useAudioDevices()
  const playing = useAudioEnginePlaying()
  const client = useApolloClient()
  const { selectedTrackId } = useSelectedTrack()
  const { playStart, playEnd, loop } = useTimelinePlayback()
  const { recording, isRecording, startRecording, stopRecording } = useRecording()

  const [permission, setPermission] =
    React.useState<MicrophonePermission | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // Keep the latest recording snapshot reachable from the (effect-driven)
  // finalize path without re-subscribing it as a dependency.
  const recordingRef = React.useRef(recording)
  recordingRef.current = recording

  // Guards against re-entry while mic acquisition is mid-flight.
  const armingRef = React.useRef(false)

  // Probe and then watch the microphone permission (passive — never prompts).
  React.useEffect(() => {
    let active = true
    void queryMicrophonePermission().then((state) => {
      if (active) setPermission(state)
    })
    const unsubscribe = subscribeMicrophonePermission((state) => {
      setPermission(state)
      // Recovering access clears a stale "blocked" message.
      if (state === "granted") setError(null)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  // Keep a warm mic stream ready while recording is armed (permission granted,
  // track selected, no take in progress) so capture can start immediately.
  React.useEffect(() => {
    if (permission !== "granted" || !selectedTrackId || isRecording) return
    void engine.prepareRecording()
  }, [engine, inputDeviceId, isRecording, permission, selectedTrackId])

  const beginRecording = React.useCallback(() => {
    if (isRecording || armingRef.current || !selectedTrackId) return
    armingRef.current = true
    setError(null)

    const provisionalStart = Math.round(engine.timecode)
    const provisionalLoopLength =
      loop && playEnd > playStart ? playEnd - playStart : undefined
    // Show the live clip immediately; reconcile the anchor once capture begins.
    startRecording(
      selectedTrackId,
      provisionalStart,
      provisionalLoopLength,
      playStart,
    )

    void (async () => {
      try {
        const { startSample, loopLength } = await engine.startRecording({
          startPlayback: true,
        })
        setPermission("granted")
        if (
          startSample !== provisionalStart ||
          loopLength !== provisionalLoopLength
        ) {
          startRecording(selectedTrackId, startSample, loopLength, playStart)
        }
      } catch (err) {
        stopRecording()
        if (isMicrophonePermissionDenied(err)) setPermission("denied")
        setError(describeMicrophoneError(err))
      } finally {
        armingRef.current = false
      }
    })()
  }, [
    engine,
    isRecording,
    loop,
    playEnd,
    playStart,
    selectedTrackId,
    startRecording,
    stopRecording,
  ])

  // Finalize the take whenever playback stops mid-recording: stop capture,
  // clear the live state, and persist the clip.
  const wasPlayingRef = React.useRef(playing)
  React.useEffect(() => {
    if (wasPlayingRef.current && !playing && isRecording) {
      const finishedRecording = recordingRef.current
      stopRecording()
      void finalizeRecording(finishedRecording)
    }
    wasPlayingRef.current = playing
    // Only the transport edge (playing → stopped while recording) should
    // finalize; `finalizeRecording`/`recording` are read via refs so they are
    // intentionally not dependencies.
  }, [playing, isRecording, stopRecording])

  async function finalizeRecording(
    finishedRecording: typeof recording,
  ): Promise<void> {
    let result
    try {
      result = await engine.stopRecording()
    } catch (err) {
      setError(describeMicrophoneError(err))
      return
    }
    // Nothing captured (e.g. an instant stop) — drop it rather than create an
    // empty clip.
    if (!finishedRecording || result.durationSamples <= 0 || result.blob.size === 0) {
      return
    }
    try {
      const placement = clipPlacementFromRecording(result)
      await uploadAudioAndCreateClip(
        client,
        result.blob,
        {
          projectId,
          trackId: finishedRecording.trackId,
          start: placement.start,
          duration: placement.duration,
          audioOffset: 0,
          mode: placement.mode,
          loopLength: placement.loopLength,
        },
        { engine },
      )
    } catch (err) {
      logError("Failed to save the recording", err)
      setError("Couldn't save the recording.")
    }
  }

  const controls = React.useMemo<RecordingControls>(
    () => ({
      isRecording,
      canRecord: selectedTrackId != null,
      permission,
      error,
      beginRecording,
      dismissError: () => setError(null),
    }),
    [isRecording, selectedTrackId, permission, error, beginRecording],
  )

  return (
    <RecordingControlsContext.Provider value={controls}>
      {children}
    </RecordingControlsContext.Provider>
  )
}
