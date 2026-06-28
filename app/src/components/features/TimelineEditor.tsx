import { Provider, type WritableAtom } from "jotai"
import { useHydrateAtoms } from "jotai/utils"

import {
  AudioEngineProvider,
  useAudioEnginePlaying,
  useAudioEngineTimecode,
} from "@/audio/AudioEngineProvider"
import { Timeline } from "@/components/composites/timeline"
import { ProjectUserSync } from "@/components/features/ProjectUserSync"
import { TimelineToolbar } from "@/components/features/TimelineToolbar"
import { TrackLanes } from "@/components/features/TrackLanes"
import {
  loopEnabledAtom,
  playEndAtom,
  playStartAtom,
  useTimelinePlayback,
  useTimelineViewport,
  viewportAtom,
} from "@/state/timeline"

/**
 * The saved editor view state used to seed the timeline, mirroring the
 * persisted fields on `ProjectUser`. Null when the user has no saved state.
 */
export type InitialEditorState = {
  viewportStart: number
  viewportEnd: number
  playStart: number
  playEnd: number
  loop: boolean
} | null | undefined

/**
 * Seeds the editor's jotai atoms from the active user's saved `ProjectUser`
 * state on first render (before children read the atoms). When there is no saved
 * state, the atoms keep their module defaults. One-shot per `Provider`.
 */
function HydrateEditorState({ state }: { state: InitialEditorState }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const values: Array<readonly [WritableAtom<unknown, any[], unknown>, unknown]> =
    state
      ? [
          [viewportAtom, { start: state.viewportStart, end: state.viewportEnd }],
          [playStartAtom, state.playStart],
          [playEndAtom, state.playEnd],
          [loopEnabledAtom, state.loop],
        ]
      : []
  useHydrateAtoms(values)
  return null
}

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
 * Entry point for the project editor's timeline. Owns a jotai `Provider` (so the
 * viewport/playback state is scoped to this editor instance and resets on
 * unmount) and an `AudioEngineProvider` (one engine per editor), then stacks the
 * playback `TimelineToolbar` above the timeline surface. The state is seeded from
 * the active user's saved `ProjectUser` (`initialState`), and a `ProjectUserSync`
 * listener persists changes back as the user edits.
 */
function TimelineEditor({
  projectId,
  initialState,
}: {
  projectId: string
  initialState?: InitialEditorState
}) {
  return (
    <Provider>
      <HydrateEditorState state={initialState} />
      <ProjectUserSync projectId={projectId} />
      <AudioEngineProvider>
        <div className="flex h-full flex-col">
          <TimelineToolbar />
          <div className="min-h-0 flex-1">
            <TimelineEditorInner projectId={projectId} />
          </div>
        </div>
      </AudioEngineProvider>
    </Provider>
  )
}

export { TimelineEditor }
