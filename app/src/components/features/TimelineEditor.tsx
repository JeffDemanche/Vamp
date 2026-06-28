import {
  AudioEngineProvider,
  useAudioEnginePlaying,
  useAudioEngineTimecode,
} from "@/audio/AudioEngineProvider"
import { Timeline } from "@/components/composites/timeline"
import { RecordingTransportController } from "@/components/features/RecordingTransportController"
import { TimelineToolbar } from "@/components/features/TimelineToolbar"
import { TrackLanes } from "@/components/features/TrackLanes"
import { useTimelinePlayback, useTimelineViewport } from "@/state/timeline"

/**
 * Domain-aware wrapper that connects the timeline's jotai viewport and playback
 * state to the pure `Timeline` composite: it reads the visible sample range and
 * play range, forwards pan/zoom gestures back into the atoms, and feeds the
 * `AudioEngine`'s live timecode down as the moving playhead while playing.
 */
function TimelineEditorInner({ projectId }: { projectId: string }) {
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
    >
      <TrackLanes projectId={projectId} />
    </Timeline>
  )
}

/**
 * Entry point for the project editor's timeline surface. Expects to be rendered
 * inside `EditorProvider` (shared jotai scope) and owns an `AudioEngineProvider`
 * (one engine per editor), then stacks the playback `TimelineToolbar` above the
 * timeline. `RecordingTransportController` stops recording when playback ends.
 */
function TimelineEditor({ projectId }: { projectId: string }) {
  return (
    <AudioEngineProvider>
      <RecordingTransportController />
      <div className="flex h-full flex-col">
        <TimelineToolbar />
        <div className="min-h-0 flex-1">
          <TimelineEditorInner projectId={projectId} />
        </div>
      </div>
    </AudioEngineProvider>
  )
}

export { TimelineEditor }
