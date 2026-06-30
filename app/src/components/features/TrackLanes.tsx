import { useQuery } from "@apollo/client/react"

import { Clip } from "@/components/composites/clip"
import {
  SWIMLANE_GAP,
  SWIMLANE_HEIGHT,
  Swimlane,
} from "@/components/composites/swimlane"
import { useTimelineCoords } from "@/components/composites/timeline"
import { ClipWaveform } from "@/components/features/ClipWaveform"
import { RecordingClip } from "@/components/features/RecordingClip"
import {
  TimelineClip,
  type TimelineClipData,
} from "@/components/features/TimelineClip"
import { ProjectQuery } from "@/projects/queries"
import { useClipDrag, useTimelineViewport } from "@/state/timeline"

/**
 * Top padding (px) above the first lane. Mirrors the container's `pt-2` so the
 * drag overlay can compute a lane's vertical offset (`pt + index * (height +
 * gap)`) and line up with the rendered swimlanes.
 */
const LANE_STACK_PADDING_TOP = 8

/**
 * Floating copy of the clip being dragged, drawn over the lanes (outside any
 * single swimlane, which would clip it) so it can follow the cursor across
 * tracks. Reads the live `useClipDrag` preview and positions itself at the
 * previewed `start` (via the timeline coordinate system) on the previewed
 * track's lane. Renders nothing when no drag is in flight. Pointer-transparent,
 * so it never interferes with the gesture or lane hit-testing.
 */
function ClipDragPreview({
  clips,
  trackIds,
}: {
  clips: TimelineClipData[]
  trackIds: string[]
}) {
  const clipDrag = useClipDrag()
  const coords = useTimelineCoords()

  if (!clipDrag) return null
  const clip = clips.find((c) => c._id === clipDrag.clipId)
  const trackIndex = trackIds.indexOf(clipDrag.trackId)
  if (!clip || trackIndex < 0) return null

  return (
    <div
      data-slot="clip-drag-preview"
      className="pointer-events-none absolute z-10 shadow-lg"
      style={{
        left: coords.sampleToX(clipDrag.start),
        top: LANE_STACK_PADDING_TOP + trackIndex * (SWIMLANE_HEIGHT + SWIMLANE_GAP),
        width: coords.samplesToWidth(clip.duration),
        height: SWIMLANE_HEIGHT,
      }}
    >
        <Clip variant="standard" label={clip.audio.filename ?? "Clip"} selected>
          <ClipWaveform
            audioId={clip.audio._id}
            audioOffset={clip.audioOffset}
            duration={clip.duration}
            selected
            hovered={false}
          />
        </Clip>
      </div>
  )
}

/**
 * Renders one `Swimlane` per project track, stacked to line up with the
 * `TrackInfo` rows in the `TrackPane` across the way. Reads the tracks from the
 * cached `project` query (already fetched by `ProjectView`) and the visible
 * sample range from the jotai timeline viewport, handing each lane the current
 * `viewportStart`/`viewportEnd` so lane content tracks pan/zoom. Each lane
 * renders its track's placed clips (`TimelineClip`) plus a `RecordingClip`,
 * which draws the live take only on the track that is actively recording.
 *
 * Each lane is wrapped in an element tagged with `data-track-id` so a clip drag
 * can hit-test which track the pointer is over. A `ClipDragPreview` overlay sits
 * above the lanes (the container is `relative`) to draw the dragged clip
 * following the cursor across tracks without being clipped by a swimlane's
 * `overflow-hidden`.
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
    <div className="relative flex flex-col gap-2 pt-2">
      {tracks.map((track) => (
        <div key={track._id} data-track-id={track._id}>
          <Swimlane viewportStart={start} viewportEnd={end}>
            {clips
              .filter((clip) => clip.track === track._id)
              .map((clip) => (
                <TimelineClip key={clip._id} clip={clip} projectId={projectId} />
              ))}
            <RecordingClip trackId={track._id} />
          </Swimlane>
        </div>
      ))}
      <ClipDragPreview clips={clips} trackIds={tracks.map((t) => t._id)} />
    </div>
  )
}
