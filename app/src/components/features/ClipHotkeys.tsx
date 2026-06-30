import { useMutation } from "@apollo/client/react"

import { useHotkey } from "@/hotkeys/HotkeyProvider"
import { ArchiveClipsMutation } from "@/projects/queries"
import { useSelectedClips } from "@/state/timeline"

/**
 * Registers the project editor's clip-related keyboard shortcuts. Renders
 * nothing; it exists only to bind hotkeys for as long as the editor is mounted.
 *
 * Pressing Delete or Backspace archives every currently-selected clip
 * (`archiveClips`) and clears the selection. The binding is disabled when no
 * clip is selected, so the keys stay available to other contexts. Must be
 * rendered inside both a `HotkeyProvider` (for `useHotkey`) and the editor's
 * jotai `Provider` (for `useSelectedClips`).
 */
export function ClipHotkeys({ projectId }: { projectId: string }) {
  const { selectedClipIds, clearSelection } = useSelectedClips()
  const [archiveClips] = useMutation(ArchiveClipsMutation)

  useHotkey(
    ["Delete", "Backspace"],
    () => {
      const clipIds = [...selectedClipIds]
      if (clipIds.length === 0) return
      clearSelection()
      void archiveClips({ variables: { input: { projectId, clipIds } } })
    },
    { enabled: selectedClipIds.size > 0 },
  )

  return null
}
