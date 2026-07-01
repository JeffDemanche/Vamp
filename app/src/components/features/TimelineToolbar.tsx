import { AlertCircle, Circle, Play, Repeat, Square } from "lucide-react"

import {
  useAudioEngine,
  useAudioEnginePlaying,
} from "@/audio/AudioEngineProvider"
import { Button } from "@/components/primitives/button"
import { RecordingSettings } from "@/components/features/RecordingSettings"
import { useRecordingControls } from "@/components/features/RecordingController"
import { useTimelinePlayback } from "@/state/timeline"
import { testIds } from "@/testIds"

/**
 * The toolbar above the timeline holding playback and timeline-wide controls.
 * Wires the editor's `AudioEngine` and timeline state to the UI:
 *
 * - a **loop** toggle that flips `loop` in the timeline's playback state (which
 *   the engine reflects, looping playback back to `playStart` at `playEnd`);
 * - a **play/stop** button that starts/stops the `AudioEngine` and reflects its
 *   playing state;
 * - a **record** button that hands off to the `RecordingController`
 *   (`beginRecording`): it acquires the microphone and starts capturing before
 *   recording state flips on. It is disabled until a track is selected, reflects
 *   blocked mic access, and any permission/capture error is surfaced beside the
 *   toolbar with a retry;
 * - a **recording settings** popover beside the record button for choosing audio
 *   input and output devices.
 *
 * Rendered inside the editor's jotai `Provider`, `AudioEngineProvider`, and
 * `RecordingController`.
 */
export function TimelineToolbar() {
  const engine = useAudioEngine()
  const playing = useAudioEnginePlaying()
  const { loop, toggleLoop } = useTimelinePlayback()
  const { isRecording, canRecord, permission, error, beginRecording } =
    useRecordingControls()

  const blocked = permission === "denied"
  const recordLabel = blocked
    ? "Microphone blocked — click to retry"
    : "Record"

  return (
    <div
      data-testid={testIds.TimelineToolbar.root}
      role="toolbar"
      aria-label="Timeline playback controls"
      className="flex h-11 shrink-0 items-center gap-1"
    >
      <Button
        type="button"
        size="sm"
        variant={playing ? "secondary" : "default"}
        aria-label={playing ? "Stop playback" : "Start playback"}
        onClick={() => (playing ? engine.stop() : engine.play())}
      >
        {playing ? <Square aria-hidden /> : <Play aria-hidden />}
        {playing ? "Stop" : "Play"}
      </Button>

      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          size="sm"
          variant={isRecording ? "destructive" : "outline"}
          aria-label={recordLabel}
          title={recordLabel}
          disabled={!canRecord || isRecording}
          onClick={beginRecording}
        >
          <Circle
            className={isRecording ? "fill-current" : undefined}
            aria-hidden
          />
          Record
        </Button>

        <RecordingSettings disabled={isRecording} />
      </div>

      <Button
        type="button"
        size="sm"
        variant={loop ? "default" : "ghost"}
        aria-label="Toggle looping"
        aria-pressed={loop}
        onClick={toggleLoop}
      >
        <Repeat aria-hidden />
        Loop
      </Button>

      {error && (
        <div
          role="alert"
          className="ml-2 flex items-center gap-1.5 text-xs text-destructive"
        >
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
