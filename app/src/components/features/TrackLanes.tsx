import { useQuery } from "@apollo/client/react"

import { Swimlane } from "@/components/composites/swimlane"
import { RecordingClip } from "@/components/features/RecordingClip"
import { TimelineClip } from "@/components/features/TimelineClip"
import { ProjectQuery } from "@/projects/queries"
import { useTimelineViewport } from "@/state/timeline"

/**
 * Renders one `Swimlane` per project track, stacked to line up with the
 * `TrackInfo` rows in the `TrackPane` across the way. Reads the tracks from the
 * cached `project` query (already fetched by `ProjectView`) and the visible
 * sample range from the jotai timeline viewport, handing each lane the current
 * `viewportStart`/`viewportEnd` so lane content tracks pan/zoom. Each lane
 * renders its track's placed clips (`TimelineClip`) plus a `RecordingClip`,
 * which draws the live take only on the track that is actively recording.
 *
 * Mounted inside `TimelineEditor`'s jotai `Provider` as the `Timeline`'s
 * children, where the children band already begins below the ruler header; the
 * leading `pt-2` plus per-lane `gap-2` mirror the `TrackPane`'s spacing so the
 * two columns stay vertically aligned.
 */
export function TrackLanes({ projectId }: { projectId: string }) {
  const { data } = useQuery(ProjectQuery, {
    variables: { id: projectId },
  })
  const tracks = data?.project?.projectData.tracks ?? []
  const clips = data?.project?.projectData.clips ?? []

  const { start, end } = useTimelineViewport()

  return (
    <div className="flex flex-col gap-2 pt-2">
      {tracks.map((track) => (
        <Swimlane key={track._id} viewportStart={start} viewportEnd={end}>
          {clips
            .filter((clip) => clip.track === track._id)
            .map((clip) => (
              <TimelineClip key={clip._id} clip={clip} />
            ))}
          <RecordingClip trackId={track._id} />
        </Swimlane>
      ))}
    </div>
  )
}
