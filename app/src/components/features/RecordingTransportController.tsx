import * as React from "react"

import { useAudioEnginePlaying } from "@/audio/AudioEngineProvider"
import { useRecording } from "@/state/timeline"

/**
 * Headless listener that ends the active recording whenever playback stops.
 * Recording is tied to the transport: arming record starts playback (if it was
 * stopped), and any stop — explicit or from the loop timer — clears recording.
 *
 * Renders nothing; mount inside `AudioEngineProvider`.
 */
export function RecordingTransportController() {
  const playing = useAudioEnginePlaying()
  const { isRecording, stopRecording } = useRecording()
  const wasPlayingRef = React.useRef(playing)

  React.useEffect(() => {
    if (wasPlayingRef.current && !playing && isRecording) {
      stopRecording()
    }
    wasPlayingRef.current = playing
  }, [playing, isRecording, stopRecording])

  return null
}
