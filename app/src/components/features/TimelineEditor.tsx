import { Provider } from "jotai"

import { Timeline } from "@/components/composites/timeline"
import { useTimelinePlayback, useTimelineViewport } from "@/state/timeline"

/**
 * Domain-aware wrapper that connects the timeline's jotai viewport and playback
 * state to the pure `Timeline` composite: it reads the visible sample range and
 * play range and forwards pan/zoom gestures back into the atoms.
 */
function TimelineEditorInner() {
  const { start, end, sampleRate, pan, zoom } = useTimelineViewport()
  const { playStart, playEnd } = useTimelinePlayback()

  return (
    <Timeline
      viewportStart={start}
      viewportEnd={end}
      sampleRate={sampleRate}
      playStart={playStart}
      playEnd={playEnd}
      onPan={pan}
      onZoom={zoom}
    />
  )
}

/**
 * Entry point for the project editor's timeline. Owns a jotai `Provider` so the
 * viewport (and future editor) state is scoped to this editor instance and
 * resets when the editor unmounts.
 */
function TimelineEditor() {
  return (
    <Provider>
      <TimelineEditorInner />
    </Provider>
  )
}

export { TimelineEditor }
