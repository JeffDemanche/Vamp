import { Provider, type WritableAtom } from "jotai"
import { useHydrateAtoms } from "jotai/utils"

import { ProjectUserSync } from "@/components/features/ProjectUserSync"
import {
  loopEnabledAtom,
  playEndAtom,
  playStartAtom,
  recordingAtom,
  selectedTrackIdAtom,
  viewportAtom,
} from "@/state/timeline"

/**
 * The saved editor view state used to seed jotai atoms, mirroring the persisted
 * fields on `ProjectUser`. Null when the user has no saved state.
 */
export type InitialEditorState = {
  viewportStart: number
  viewportEnd: number
  playStart: number
  playEnd: number
  loop: boolean
  selectedTrack?: string | null
  recording?: {
    track: string
    startSample: number
    startedAt: string
  } | null
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
          [selectedTrackIdAtom, state.selectedTrack ?? null],
          [
            recordingAtom,
            state.recording
              ? {
                  trackId: state.recording.track,
                  startSample: state.recording.startSample,
                  startedAt: state.recording.startedAt,
                }
              : null,
          ],
        ]
      : []
  useHydrateAtoms(values)
  return null
}

/**
 * Scopes the project editor's jotai state to one editor instance: hydrates atoms
 * from the user's saved `ProjectUser` on mount and persists changes back via
 * `ProjectUserSync`. Wrap both the track pane and the timeline so they share
 * selection, recording, viewport, and playback state.
 */
export function EditorProvider({
  projectId,
  initialState,
  children,
}: {
  projectId: string
  initialState?: InitialEditorState
  children: React.ReactNode
}) {
  return (
    <Provider>
      <HydrateEditorState state={initialState} />
      <ProjectUserSync projectId={projectId} />
      {children}
    </Provider>
  )
}
