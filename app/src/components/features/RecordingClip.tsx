import {
  useAudioEnginePlaying,
  useRecordingBuffer,
  useRecordingCapturedSamples,
} from "@/audio/AudioEngineProvider"
import { Clip } from "@/components/composites/clip"
import { SwimlaneItem } from "@/components/composites/swimlane"
import { ClipWaveform } from "@/components/features/ClipWaveform"
import { recordingClipDisplay } from "@/components/features/RecordingController"
import { useRecording } from "@/state/timeline"

/**
 * The live, in-progress recording clip drawn on its track's `Swimlane`. Reads
 * the active recording (`useRecording`) and how much audio the engine has
 * captured so far on the audio clock (`useRecordingCapturedSamples`), then
 * renders a red `recording`-variant `Clip` that begins at the recording's
 * `startSample`.
 *
 * For a flat take the clip grows smoothly toward the playhead. For a looped take
 * it grows until the first loop point, then locks to one loop region (stacked
 * mode) — matching how the persisted clip will land. A live waveform is drawn
 * from the engine's in-progress PCM tap, using the same stacked/flat layering
 * rules as placed clips.
 *
 * Renders nothing unless there is an active recording on `trackId`, so it
 * vanishes the moment recording stops; a placed `standard` clip replaces it
 * once the take is saved.
 *
 * Mount inside a `Swimlane` (for the sample→pixel coordinate system) and the
 * `AudioEngineProvider` (for the capture clock and recording buffer).
 */
export function RecordingClip({ trackId }: { trackId: string }) {
  const { recording } = useRecording()
  const playing = useAudioEnginePlaying()
  const capturedSamples = useRecordingCapturedSamples(playing)
  const buffer = useRecordingBuffer()

  if (!recording || recording.trackId !== trackId) return null

  const { duration, mode, loopLength } = recordingClipDisplay(
    capturedSamples,
    recording.loopLength,
  )

  return (
    <SwimlaneItem start={recording.startSample} duration={duration}>
      <Clip variant="recording" label="Recording">
        <ClipWaveform
          buffer={buffer}
          audioOffset={0}
          duration={duration}
          mode={mode}
          loopLength={loopLength}
          selected={false}
          hovered={false}
          variant="recording"
        />
      </Clip>
    </SwimlaneItem>
  )
}
