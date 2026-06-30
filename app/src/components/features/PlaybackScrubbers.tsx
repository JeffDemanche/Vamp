import * as React from "react"

import { useTimelineCoords } from "@/components/composites/timeline"
import {
  type TimelineDragHandlers,
  useTimelineDrag,
} from "@/components/primitives/use-timeline-drag"
import { cn } from "@/lib/utils"
import { type PlayBoundarySide, useTimelinePlayback } from "@/state/timeline"

/** Grab-zone width (px), centered on the scrubber, comfortable for dragging. */
const HANDLE_WIDTH = 16

type ScrubberHandleProps = {
  /** Which boundary this handle moves. */
  side: PlayBoundarySide
  /** x offset (px) of the scrubber within the header band. */
  x: number
  dragging: boolean
  dragHandlers: TimelineDragHandlers
}

/**
 * Transparent grab-zone laid over a scrubber triangle (which the
 * `TimelinePlayhead` canvas draws). It supplies the interaction — cursor
 * affordance, hover/active highlight, and the pointer handlers — while the
 * canvas remains the single source of visual truth for the marker itself.
 */
function ScrubberHandle({ side, x, dragging, dragHandlers }: ScrubberHandleProps) {
  return (
    <div
      role="slider"
      aria-label={side === "start" ? "Playback start" : "Playback end"}
      data-slot="timeline-scrubber-handle"
      data-side={side}
      className={cn(
        "pointer-events-auto absolute top-0 h-full -translate-x-1/2 touch-none cursor-ew-resize rounded-sm transition-colors",
        dragging ? "bg-foreground/15" : "hover:bg-foreground/10",
      )}
      style={{ left: x, width: HANDLE_WIDTH }}
      {...dragHandlers}
    />
  )
}

/**
 * Draggable handles for the timeline's **Playback range** scrubbers, rendered
 * into the `Timeline`'s header overlay. Reads the play range (`useTimelinePlayback`)
 * and the surface's coordinate mapping (`useTimelineCoords`) to position a handle
 * at `playStart` and — only while looping, matching the canvas scrubbers — at
 * `playEnd`.
 *
 * Dragging either handle moves it along the timeline via the standardized
 * `useTimelineDrag` gesture. When looping, dragging one handle past the other
 * swaps their roles (`dragPlayBoundary`), so the dragged handle keeps following
 * the cursor; the active side is tracked across the gesture in a ref. With
 * looping off only the start handle shows, and it simply repositions `playStart`.
 */
function PlaybackScrubbers() {
  const coords = useTimelineCoords()
  const { playStart, playEnd, loop, setPlayStart, dragPlayBoundary } =
    useTimelinePlayback()

  // Which boundary the in-flight drag currently controls; flips on a swap.
  const activeSide = React.useRef<PlayBoundarySide>("start")

  const startDrag = useTimelineDrag({
    clientXToSample: coords.clientXToSample,
    onDragStart: () => {
      activeSide.current = "start"
    },
    onDrag: ({ sample }) => {
      // With looping off there's no visible end to swap with; just move start.
      if (loop) {
        activeSide.current = dragPlayBoundary(activeSide.current, sample)
      } else {
        setPlayStart(sample)
      }
    },
  })

  const endDrag = useTimelineDrag({
    clientXToSample: coords.clientXToSample,
    onDragStart: () => {
      activeSide.current = "end"
    },
    onDrag: ({ sample }) => {
      activeSide.current = dragPlayBoundary(activeSide.current, sample)
    },
  })

  return (
    <>
      <ScrubberHandle
        side="start"
        x={coords.sampleToX(playStart)}
        dragging={startDrag.dragging}
        dragHandlers={startDrag.dragHandlers}
      />
      {loop && (
        <ScrubberHandle
          side="end"
          x={coords.sampleToX(playEnd)}
          dragging={endDrag.dragging}
          dragHandlers={endDrag.dragHandlers}
        />
      )}
    </>
  )
}

export { PlaybackScrubbers }
