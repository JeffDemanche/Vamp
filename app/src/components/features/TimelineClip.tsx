import { Clip } from "@/components/composites/clip"
import { SwimlaneItem } from "@/components/composites/swimlane"

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
 */
export function TimelineClip({ clip }: { clip: TimelineClipData }) {
  return (
    <SwimlaneItem start={clip.start} duration={clip.duration}>
      <Clip variant="standard" label={clip.audio.filename ?? "Clip"} />
    </SwimlaneItem>
  )
}
