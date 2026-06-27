import * as React from "react"

import { TimelineRuler } from "@/components/primitives/timeline-ruler"
import { cn } from "@/lib/utils"

type TimelineProps = {
  /** Sample coordinate at the left-hand cutoff of the timeline. May be negative. */
  viewportStart: number
  /** Sample coordinate at the right-hand cutoff of the timeline. May be negative. */
  viewportEnd: number
  /** Samples per second, used to render the ruler. */
  sampleRate: number
  /** Pan the viewport by a sample delta (positive = move the view later/right). */
  onPan?: (deltaSamples: number) => void
  /** Zoom around a focus sample; `factor` < 1 zooms in, > 1 zooms out. */
  onZoom?: (factor: number, focusSample: number) => void
  /** Track lanes / regions rendered on top of the ruler. */
  children?: React.ReactNode
  className?: string
}

/** Multiplier applied per unit of wheel delta when zooming. */
const ZOOM_SENSITIVITY = 0.0015

/**
 * Fixed height, in pixels, reserved along the top of the timeline for the
 * ruler's timecode labels (and future scrubbing controls). Track lanes are laid
 * out below this band; consumers that align UI with the lanes (e.g. the track
 * pane) should offset by the same amount.
 */
export const TIMELINE_HEADER_HEIGHT = 32

/**
 * The horizontal editing timeline surface. Renders a `TimelineRuler` underneath
 * everything as a background grid and lays its `children` (tracks/regions) on
 * top. Pointer drags pan the view and ctrl/⌘ + wheel (or pinch) zooms; raw
 * pixel gestures are converted to sample deltas and surfaced through the
 * `onPan`/`onZoom` callbacks.
 *
 * Pure presentational composite: the visible range arrives via props and
 * gestures are emitted as callbacks. The only internal state is its measured
 * width (needed to map pixels → samples) and the ephemeral drag bookkeeping.
 */
function Timeline({
  viewportStart,
  viewportEnd,
  sampleRate,
  onPan,
  onZoom,
  children,
  className,
}: TimelineProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = React.useState(0)
  const dragState = React.useRef<{ pointerId: number; lastX: number } | null>(
    null,
  )

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const span = viewportEnd - viewportStart
  const samplesPerPixel = width > 0 ? span / width : 0

  // Native, non-passive wheel listener so we can preventDefault the page scroll.
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleWheel = (event: WheelEvent) => {
      if (samplesPerPixel <= 0) return
      event.preventDefault()

      if (event.ctrlKey || event.metaKey) {
        const rect = el.getBoundingClientRect()
        const focusSample = viewportStart + (event.clientX - rect.left) * samplesPerPixel
        const factor = Math.exp(event.deltaY * ZOOM_SENSITIVITY)
        onZoom?.(factor, focusSample)
      } else {
        const deltaPx = event.deltaX !== 0 ? event.deltaX : event.deltaY
        onPan?.(deltaPx * samplesPerPixel)
      }
    }

    el.addEventListener("wheel", handleWheel, { passive: false })
    return () => el.removeEventListener("wheel", handleWheel)
  }, [samplesPerPixel, viewportStart, onPan, onZoom])

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || samplesPerPixel <= 0) return
    dragState.current = { pointerId: event.pointerId, lastX: event.clientX }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragState.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const deltaX = event.clientX - drag.lastX
    drag.lastX = event.clientX
    // Dragging right should reveal earlier content, so pan in the opposite sense.
    onPan?.(-deltaX * samplesPerPixel)
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragState.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragState.current = null
  }

  return (
    <div
      ref={containerRef}
      data-slot="timeline"
      role="region"
      aria-label="Timeline"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={cn(
        "relative h-full w-full touch-none overflow-hidden rounded-lg border border-border bg-muted/30 select-none",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <TimelineRuler
          viewportStart={viewportStart}
          viewportEnd={viewportEnd}
          sampleRate={sampleRate}
        />
      </div>
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ top: TIMELINE_HEADER_HEIGHT }}
      >
        {children}
      </div>
    </div>
  )
}

export { Timeline }
