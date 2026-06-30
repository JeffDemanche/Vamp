import * as React from "react"
import { useMutation } from "@apollo/client/react"

import { Clip } from "@/components/composites/clip"
import { SwimlaneItem } from "@/components/composites/swimlane"
import { useTimelineCoords } from "@/components/composites/timeline"
import { ClipWaveform } from "@/components/features/ClipWaveform"
import { useTimelineDrag } from "@/components/primitives/use-timeline-drag"
import { cn } from "@/lib/utils"
import { UpdateClipMutation } from "@/projects/queries"
import { useSelectedClips, useSetClipDrag } from "@/state/timeline"

/** The clip data this component needs to place itself, in timeline samples. */
export type TimelineClipData = {
  _id: string
  start: number
  duration: number
  /** Sample offset into the source audio where the clip's window begins. */
  audioOffset: number
  /** `_id` of the `ProjectTrack` the clip currently lives on. */
  track: string
  audio: {
    /** `_id` of the source `ProjectAudio`, used to fetch the decoded buffer for its waveform. */
    _id: string
    filename?: string | null
  }
}

/**
 * Pointer movement (px) the cursor must travel before a press becomes a drag.
 * Below this a press is treated as a click (selection), so a small wobble while
 * clicking doesn't nudge the clip or fire a no-op `updateClip`.
 */
const DRAG_THRESHOLD_PX = 3

/**
 * The id of the track swimlane under a viewport point, or `null` when the point
 * is outside every lane. Lanes are tagged with `data-track-id` by `TrackLanes`;
 * we hit-test their bounding rects vertically (rather than `elementFromPoint`,
 * which the dragged clip — pinned under the cursor — would otherwise intercept).
 */
function trackIdAtClientY(clientY: number): string | null {
  const lanes = document.querySelectorAll<HTMLElement>("[data-track-id]")
  for (const lane of lanes) {
    const rect = lane.getBoundingClientRect()
    if (clientY >= rect.top && clientY <= rect.bottom) {
      return lane.getAttribute("data-track-id")
    }
  }
  return null
}

/** Bookkeeping for a single in-flight clip drag. */
type ClipGesture = {
  /** Pointer position at press, to measure the click/drag threshold against. */
  downClientX: number
  downClientY: number
  /** Sample under the cursor at press, the anchor for the horizontal delta. */
  downSample: number
  /** The clip's placement at press, to detect whether anything actually moved. */
  originStart: number
  originTrack: string
  /** The latest previewed placement, committed on release. */
  nextStart: number
  nextTrack: string
  /** Whether the threshold has been crossed (a real drag, not a click). */
  moved: boolean
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
 * selection. Dragging it (past a small threshold) moves it horizontally —
 * updating its `start` — and, when the pointer crosses into another track's
 * swimlane, previews the clip on that track; on release it commits the new
 * `start`/`track` through `updateClip`. The live preview is published to
 * `setClipDrag` so `TrackLanes` can draw the clip following the cursor (the
 * source clip dims in place until the move is confirmed).
 */
export function TimelineClip({
  clip,
  projectId,
}: {
  clip: TimelineClipData
  projectId: string
}) {
  const { isClipSelected, toggleClip } = useSelectedClips()
  const selected = isClipSelected(clip._id)
  const coords = useTimelineCoords()
  const setClipDrag = useSetClipDrag()
  const [updateClip] = useMutation(UpdateClipMutation)
  const [dragging, setDragging] = React.useState(false)
  const [hovered, setHovered] = React.useState(false)

  const gesture = React.useRef<ClipGesture | null>(null)
  // True between a real drag ending and its trailing native `click`, so that
  // click is swallowed instead of toggling the selection of a clip we moved.
  const suppressClick = React.useRef(false)

  const { dragHandlers } = useTimelineDrag({
    clientXToSample: coords.clientXToSample,
    // Keep the clip's native click so a press without movement still selects it.
    preventDefault: false,
    onDragStart: ({ sample }, event) => {
      gesture.current = {
        downClientX: event.clientX,
        downClientY: event.clientY,
        downSample: sample,
        originStart: clip.start,
        originTrack: clip.track,
        nextStart: clip.start,
        nextTrack: clip.track,
        moved: false,
      }
      suppressClick.current = false
    },
    onDrag: ({ sample }, event) => {
      const g = gesture.current
      if (!g) return
      if (!g.moved) {
        const dx = event.clientX - g.downClientX
        const dy = event.clientY - g.downClientY
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
        g.moved = true
        setDragging(true)
      }
      const nextStart = Math.round(g.originStart + (sample - g.downSample))
      const nextTrack = trackIdAtClientY(event.clientY) ?? g.originTrack
      g.nextStart = nextStart
      g.nextTrack = nextTrack
      setClipDrag({ clipId: clip._id, start: nextStart, trackId: nextTrack })
    },
    onDragEnd: () => {
      const g = gesture.current
      gesture.current = null
      const clearPreview = () => {
        setDragging(false)
        setClipDrag(null)
      }
      if (!g || !g.moved) {
        clearPreview()
        return
      }
      // A real drag happened: swallow the trailing click and persist the move.
      suppressClick.current = true
      const changed =
        g.nextStart !== g.originStart || g.nextTrack !== g.originTrack
      if (!changed) {
        clearPreview()
        return
      }
      // Hold the preview (overlay + dimmed source) until the server confirms so
      // the clip doesn't flash back to its old spot during the round-trip.
      void updateClip({
        variables: {
          input: {
            projectId,
            clipId: clip._id,
            start: g.nextStart,
            track: g.nextTrack,
          },
        },
      }).finally(clearPreview)
    },
  })

  return (
    <SwimlaneItem start={clip.start} duration={clip.duration}>
      <Clip
        variant="standard"
        label={clip.audio.filename ?? "Clip"}
        selected={selected}
        // Hide the source clip while dragging; the `TrackLanes` overlay draws
        // the moving copy (possibly on another lane).
        className={cn(dragging && "opacity-0")}
        onSelect={(event) => {
          if (suppressClick.current) {
            suppressClick.current = false
            return
          }
          toggleClip(clip._id, event.metaKey || event.ctrlKey)
        }}
        onPointerDown={dragHandlers.onPointerDown}
        onPointerMove={dragHandlers.onPointerMove}
        onPointerUp={dragHandlers.onPointerUp}
        onPointerCancel={dragHandlers.onPointerCancel}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <ClipWaveform
          audioId={clip.audio._id}
          audioOffset={clip.audioOffset}
          duration={clip.duration}
          selected={selected}
          hovered={hovered}
        />
      </Clip>
    </SwimlaneItem>
  )
}
