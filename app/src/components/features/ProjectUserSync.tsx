import { useMutation } from "@apollo/client/react"
import * as React from "react"

import { UpdateProjectUserStateMutation } from "@/projects/queries"
import { usePersistedEditorState } from "@/state/timeline"

/** Debounce window (ms) before persisting editor view-state changes. */
const SYNC_DEBOUNCE_MS = 600

/**
 * Headless listener that persists the signed-in user's editor view state to the
 * server (`ProjectUser`) whenever it changes locally. It subscribes to the
 * aggregated `persistedEditorStateAtom` (timeline viewport + playback range +
 * loop), debounces bursts of changes (e.g. pan/zoom), and upserts via
 * `updateProjectUserState`.
 *
 * The first (mount) value is skipped so simply opening the editor never clobbers
 * saved state. Extensible by construction: it syncs whatever the derived atom
 * exposes, so persisting a new field only means adding it there and on the
 * server — no change here.
 *
 * Renders nothing; mount it inside the editor's jotai `Provider`.
 */
export function ProjectUserSync({ projectId }: { projectId: string }) {
  const state = usePersistedEditorState()
  const [updateState] = useMutation(UpdateProjectUserStateMutation)
  const seededRef = React.useRef(false)

  React.useEffect(() => {
    if (!seededRef.current) {
      seededRef.current = true
      return
    }
    const handle = setTimeout(() => {
      void updateState({ variables: { input: { projectId, ...state } } })
    }, SYNC_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [projectId, state, updateState])

  return null
}
