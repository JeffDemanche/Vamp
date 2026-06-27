import { Provider } from "jotai"

import {
  AudioEngineProvider,
  useAudioEnginePlaying,
  useAudioEngineTimecode,
} from "@/audio/AudioEngineProvider"
import { Timeline } from "@/components/composites/timeline"
import { TimelineToolbar } from "@/components/features/TimelineToolbar"
import { useTimelinePlayback, useTimelineViewport } from "@/state/timeline"

/**
 * Domain-aware wrapper that connects the timeline's jotai viewport and playback
 * state to the pure `Timeline` composite: it reads the visible sample range and
 * play range, forwards pan/zoom gestures back into the atoms, and feeds the
 * `AudioEngine`'s live timecode down as the moving playhead while playing.
 */
function TimelineEditorInner() {
  const { start, end, sampleRate, pan, zoom } = useTimelineViewport()
  const { playStart, playEnd, loop } = useTimelinePlayback()

  const playing = useAudioEnginePlaying()
  const timecode = useAudioEngineTimecode(playing)

  return (
    <Timeline
      viewportStart={start}
      viewportEnd={end}
      sampleRate={sampleRate}
      playStart={playStart}
      // `playEnd` only takes effect while looping, so only show its scrubber then.
      playEnd={loop ? playEnd : null}
      playbackPosition={playing ? timecode : null}
      onPan={pan}
      onZoom={zoom}
    />
  )
}

/**
 * Entry point for the project editor's timeline. Owns a jotai `Provider` (so the
 * viewport/playback state is scoped to this editor instance and resets on
 * unmount) and an `AudioEngineProvider` (one engine per editor), then stacks the
 * playback `TimelineToolbar` above the timeline surface.
 */
function TimelineEditor() {
  return (
    <Provider>
      <AudioEngineProvider>
        <div className="flex h-full flex-col">
          <TimelineToolbar />
          <div className="min-h-0 flex-1">
            <TimelineEditorInner />
          </div>
        </div>
      </AudioEngineProvider>
    </Provider>
  )
}

export { TimelineEditor }
