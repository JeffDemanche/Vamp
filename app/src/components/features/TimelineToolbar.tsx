import { Circle, Play, Repeat, Square } from "lucide-react"

import {
  useAudioEngine,
  useAudioEnginePlaying,
} from "@/audio/AudioEngineProvider"
import { Button } from "@/components/primitives/button"
import {
  useRecording,
  useSelectedTrack,
  useTimelinePlayback,
} from "@/state/timeline"

/**
 * The toolbar above the timeline holding playback and timeline-wide controls.
 * Wires the editor's `AudioEngine` and timeline state to the UI:
 *
 * - a **loop** toggle that flips `loop` in the timeline's playback state (which
 *   the engine reflects, looping playback back to `playStart` at `playEnd`);
 * - a **play/stop** button that starts/stops the `AudioEngine` and reflects its
 *   playing state;
 * - a **record** button that arms recording on the selected track and starts
 *   playback if stopped (`startSample` is the playback start when stopped, or
 *   the live playhead when already playing). Recording ends when playback stops.
 *
 * Rendered inside the editor's jotai `Provider` and `AudioEngineProvider`.
 */
export function TimelineToolbar() {
  const engine = useAudioEngine()
  const playing = useAudioEnginePlaying()
  const { loop, toggleLoop, playStart } = useTimelinePlayback()
  const { selectedTrackId } = useSelectedTrack()
  const { isRecording, startRecording } = useRecording()

  const handleRecord = () => {
    if (isRecording || !selectedTrackId) return
    const startSample = playing ? engine.timecode : playStart
    startRecording(selectedTrackId, startSample)
    if (!playing) engine.play()
  }

  return (
    <div
      data-testid="timeline-toolbar"
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

      <Button
        type="button"
        size="sm"
        variant={isRecording ? "destructive" : "outline"}
        aria-label="Record"
        disabled={!selectedTrackId || isRecording}
        onClick={handleRecord}
      >
        <Circle
          className={isRecording ? "fill-current" : undefined}
          aria-hidden
        />
        Record
      </Button>

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
    </div>
  )
}
