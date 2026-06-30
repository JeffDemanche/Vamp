import {
  useAudioEngine,
  useAudioEnginePlaying,
} from "@/audio/AudioEngineProvider"
import { useRecordingControls } from "@/components/features/RecordingController"
import { useHotkey } from "@/hotkeys/HotkeyProvider"
import { useTimelinePlayback } from "@/state/timeline"

/**
 * Registers the project editor's transport keyboard shortcuts. Renders nothing;
 * it exists only to bind hotkeys for as long as the editor is mounted.
 *
 * - **Space** toggles playback: stop if playing, otherwise play (which, while a
 *   take is in progress, ends the recording just like clicking Stop).
 * - **R** arms recording on the selected track; ignored when recording can't be
 *   armed (no track selected) or a take is already running.
 * - **L** toggles looping.
 *
 * Must be rendered inside the editor's `AudioEngineProvider`,
 * `RecordingController`, jotai `Provider`, and a `HotkeyProvider`.
 */
export function TransportHotkeys() {
  const engine = useAudioEngine()
  const playing = useAudioEnginePlaying()
  const { toggleLoop } = useTimelinePlayback()
  const { beginRecording, canRecord, isRecording } = useRecordingControls()

  useHotkey("space", () => {
    if (playing) engine.stop()
    else engine.play()
  })

  useHotkey(
    "r",
    () => {
      beginRecording()
    },
    { enabled: canRecord && !isRecording },
  )

  useHotkey("l", () => {
    toggleLoop()
  })

  return null
}
