import { Play, Repeat, Square } from "lucide-react";

import {
  useAudioEngine,
  useAudioEnginePlaying,
} from "@/audio/AudioEngineProvider";
import { Button } from "@/components/primitives/button";
import { useTimelinePlayback } from "@/state/timeline";

/**
 * The toolbar above the timeline holding playback and timeline-wide controls.
 * Wires the editor's `AudioEngine` and timeline state to the UI:
 *
 * - a **loop** toggle that flips `loop` in the timeline's playback state (which
 *   the engine reflects, looping playback back to `playStart` at `playEnd`);
 * - a **play/stop** button that starts/stops the `AudioEngine` and reflects its
 *   playing state.
 *
 * Rendered inside the editor's jotai `Provider` and `AudioEngineProvider`.
 */
export function TimelineToolbar() {
  const engine = useAudioEngine();
  const playing = useAudioEnginePlaying();
  const { loop, toggleLoop } = useTimelinePlayback();

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
        variant={loop ? "default" : "ghost"}
        aria-label="Toggle looping"
        aria-pressed={loop}
        onClick={toggleLoop}
      >
        <Repeat aria-hidden />
        Loop
      </Button>
    </div>
  );
}
