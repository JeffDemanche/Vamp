import { useMutation, useQuery } from "@apollo/client/react"
import { Loader2, Plus } from "lucide-react"

import { TrackInfo } from "@/components/composites/track-info"
import {
  TIMELINE_HEADER_HEIGHT,
  TIMELINE_TOOLBAR_HEIGHT,
} from "@/components/composites/timeline"
import { Button } from "@/components/primitives/button"
import {
  CreateTrackMutation,
  DeleteTrackMutation,
  ProjectQuery,
} from "@/projects/queries"
import { useSelectedTrack } from "@/state/timeline"
import { testIds } from "@/testIds"

/**
 * The pane to the left of the timeline listing the project's tracks. Reads the
 * tracks from the cached `Project` query (already fetched by `ProjectView`) and
 * renders a `TrackInfo` composite per track, each with a delete control, plus an
 * "add track" button below the list. Creating/deleting a track returns the
 * updated `ProjectData`, which Apollo merges into the cache so the list (and the
 * timeline lanes) refresh automatically.
 */
export function TrackPane({ projectId }: { projectId: string }) {
  const { data } = useQuery(ProjectQuery, {
    variables: { id: projectId },
  })

  const [createTrack, { loading: creating }] = useMutation(CreateTrackMutation)
  const [deleteTrack, { loading: deleting }] = useMutation(DeleteTrackMutation)
  const { selectedTrackId, setSelectedTrackId } = useSelectedTrack()

  const tracks = data?.project?.projectData.tracks ?? []

  return (
    <div
      data-testid={testIds.TrackPane.root}
      className="flex h-full w-56 shrink-0 flex-col gap-2 overflow-y-auto"
    >
      {/* Reserve the timeline's toolbar + header band so rows align with track lanes. */}
      <div
        style={{ height: TIMELINE_TOOLBAR_HEIGHT + TIMELINE_HEADER_HEIGHT }}
        className="shrink-0"
      />

      {tracks.map((track) => (
        <TrackInfo
          key={track._id}
          name={track.name}
          selected={selectedTrackId === track._id}
          onSelect={() =>
            setSelectedTrackId(selectedTrackId === track._id ? null : track._id)
          }
          deleteDisabled={deleting}
          onDelete={() =>
            deleteTrack({
              variables: { input: { projectId, trackId: track._id } },
            })
          }
        />
      ))}

      <Button
        variant="ghost"
        size="sm"
        disabled={creating}
        onClick={() => createTrack({ variables: { input: { projectId } } })}
        className="mt-1 w-full justify-start text-muted-foreground"
      >
        {creating ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
        Add track
      </Button>
    </div>
  )
}
