import { useQuery } from "@apollo/client/react"
import { Plus } from "lucide-react"

import { TrackInfo } from "@/components/composites/track-info"
import { TIMELINE_HEADER_HEIGHT } from "@/components/composites/timeline"
import { Button } from "@/components/primitives/button"
import { ProjectQuery } from "@/projects/queries"

/**
 * The pane to the left of the timeline listing the project's tracks. Reads the
 * tracks from the cached `Project` query (already fetched by `ProjectView`) and
 * renders a `TrackInfo` composite per track, with a subtle "add track" button
 * below the list. The create action is inert for now.
 */
export function TrackPane({ projectId }: { projectId: string }) {
  const { data } = useQuery(ProjectQuery, {
    variables: { id: projectId },
  })

  const tracks = data?.project?.projectData.tracks ?? []

  return (
    <div
      data-testid="track-pane"
      className="flex h-full w-56 shrink-0 flex-col gap-2 overflow-y-auto"
    >
      {/* Reserve the timeline's header band so rows align with track lanes. */}
      <div style={{ height: TIMELINE_HEADER_HEIGHT }} className="shrink-0" />

      {tracks.map((track) => (
        <TrackInfo key={track._id} name={track.name} />
      ))}

      <Button
        variant="ghost"
        size="sm"
        className="mt-1 w-full justify-start text-muted-foreground"
      >
        <Plus aria-hidden />
        Add track
      </Button>
    </div>
  )
}
