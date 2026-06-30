import { Clip } from "@/components/composites/clip"
import { SwimlaneItem } from "@/components/composites/swimlane"
import { useSelectedClip } from "@/state/timeline"

/** The clip data this component needs to place itself, in timeline samples. */
export type TimelineClipData = {
  _id: string
  start: number
  duration: number
  audio: {
    filename?: string | null
  }
}

/**
 * A placed (persisted) clip drawn on its track's `Swimlane`. Reads the clip's
 * sample `start`/`duration` to position itself via `SwimlaneItem` and renders a
 * `standard`-variant `Clip`, labelled with the source audio's filename (or a
 * generic fallback for recordings, which have none).
 *
 * Mount inside a `Swimlane` (for the sample→pixel coordinate system). Pairs with
 * `RecordingClip`, which draws the live take before it becomes one of these.
 *
 * Clicking the clip selects it (toggling off if it was already selected) via
 * the client-only `useSelectedClip` state, mirroring how `TrackInfo` rows drive
 * track selection.
 */
export function TimelineClip({ clip }: { clip: TimelineClipData }) {
  const { selectedClipId, setSelectedClipId } = useSelectedClip()
  const selected = selectedClipId === clip._id

  return (
    <SwimlaneItem start={clip.start} duration={clip.duration}>
      <Clip
        variant="standard"
        label={clip.audio.filename ?? "Clip"}
        selected={selected}
        onSelect={() => setSelectedClipId(selected ? null : clip._id)}
      />
    </SwimlaneItem>
  )
}
