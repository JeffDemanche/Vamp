import { Clip } from "@/components/composites/clip"
import { SwimlaneItem } from "@/components/composites/swimlane"
import { useSelectedClips } from "@/state/timeline"

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
 * Clicking the clip selects it via the client-only `useSelectedClips` state: a
 * plain click selects just this clip (toggling off if it was already the sole
 * selection), while ⌘/Ctrl-click adds or removes it from a multi-clip
 * selection. The selection drives commands like the project view's delete
 * hotkey, which archives every selected clip.
 */
export function TimelineClip({ clip }: { clip: TimelineClipData }) {
  const { isClipSelected, toggleClip } = useSelectedClips()
  const selected = isClipSelected(clip._id)

  return (
    <SwimlaneItem start={clip.start} duration={clip.duration}>
      <Clip
        variant="standard"
        label={clip.audio.filename ?? "Clip"}
        selected={selected}
        onSelect={(event) =>
          toggleClip(clip._id, event.metaKey || event.ctrlKey)
        }
      />
    </SwimlaneItem>
  )
}
