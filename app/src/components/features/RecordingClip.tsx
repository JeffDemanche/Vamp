import {
  useAudioEnginePlaying,
  useAudioEngineTimecode,
} from "@/audio/AudioEngineProvider"
import { Clip } from "@/components/composites/clip"
import { SwimlaneItem } from "@/components/composites/swimlane"
import { useRecording } from "@/state/timeline"

/**
 * The live, in-progress recording clip drawn on its track's `Swimlane`. Reads
 * the active recording (`useRecording`) and the engine's live `timecode`
 * (polled on `requestAnimationFrame` while playing), then renders a red
 * `recording`-variant `Clip` that begins at the recording's `startSample` and
 * grows smoothly toward the playhead as the take proceeds.
 *
 * Renders nothing unless there is an active recording on `trackId`, so it
 * vanishes the moment recording stops; a placed `standard` clip will replace it
 * once persisted recordings are implemented.
 *
 * Mount inside a `Swimlane` (for the sample→pixel coordinate system) and the
 * `AudioEngineProvider` (for the timecode).
 */
export function RecordingClip({ trackId }: { trackId: string }) {
  const { recording } = useRecording()
  const playing = useAudioEnginePlaying()
  const timecode = useAudioEngineTimecode(playing)

  if (!recording || recording.trackId !== trackId) return null

  const duration = Math.max(0, timecode - recording.startSample)

  return (
    <SwimlaneItem start={recording.startSample} duration={duration}>
      <Clip variant="recording" label="Recording" />
    </SwimlaneItem>
  )
}
