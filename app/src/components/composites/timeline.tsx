import * as React from "react"

import { TimelinePlayhead } from "@/components/primitives/timeline-playhead"
import { TimelineRuler } from "@/components/primitives/timeline-ruler"
import { cn } from "@/lib/utils"

type TimelineProps = {
  /** Sample coordinate at the left-hand cutoff of the timeline. May be negative. */
  viewportStart: number
  /** Sample coordinate at the right-hand cutoff of the timeline. May be negative. */
  viewportEnd: number
  /** Samples per second, used to render the ruler. */
  sampleRate: number
  /** Sample where playback begins; drawn as a forward-facing scrubber. */
  playStart: number
  /** Sample where playback ends/loops; drawn as a backward-facing scrubber. Null hides it. */
  playEnd: number | null
  /**
   * Live playback position (sample) to draw as a moving playhead, or null when
   * playback is stopped. Distinct from the static `playStart`/`playEnd` scrubbers.
   */
  playbackPosition?: number | null
  /** Pan the viewport by a sample delta (positive = move the view later/right). */
  onPan?: (deltaSamples: number) => void
  /** Zoom around a focus sample; `factor` < 1 zooms in, > 1 zooms out. */
  onZoom?: (factor: number, focusSample: number) => void
  /**
   * Interactive content layered over the header band (top `TIMELINE_HEADER_HEIGHT`
   * pixels) — e.g. the playback scrubber drag handles. The band itself ignores
   * pointer events (so empty space still pans the timeline); individual elements
   * opt back in with `pointer-events-auto`. Rendered inside the timeline's
   * coordinate context, so it can read `useTimelineCoords`.
   */
  headerOverlay?: React.ReactNode
  /** Track lanes / regions rendered on top of the ruler. */
  children?: React.ReactNode
  className?: string
}

/**
 * The sample ↔ pixel coordinate system the `Timeline` exposes to its subtree,
 * derived from the measured surface width and the visible sample window. Mirrors
 * the per-lane `SwimlaneCoords`, but spans the whole timeline so header-band
 * overlays (scrubber handles, future markers) can position themselves and map
 * pointer positions to samples. `clientXToSample` reads the live container rect,
 * so it stays correct as the surface moves/resizes.
 */
export type TimelineCoords = {
  /** Sample coordinate at the surface's left edge. May be negative. */
  viewportStart: number
  /** Sample coordinate at the surface's right edge. May be negative. */
  viewportEnd: number
  /** Measured surface width in CSS pixels (0 before first measurement). */
  width: number
  /** Samples represented by a single pixel (0 before first measurement). */
  samplesPerPixel: number
  /** Convert a sample position to an x offset (px) from the surface's left edge. */
  sampleToX: (sample: number) => number
  /** Convert a sample duration to a width (px). */
  samplesToWidth: (samples: number) => number
  /** Convert an x offset (px) from the surface's left edge to a sample position. */
  xToSample: (x: number) => number
  /** Convert an absolute pointer `clientX` (px) to a sample position. */
  clientXToSample: (clientX: number) => number
}

const TimelineCoordsContext = React.createContext<TimelineCoords | null>(null)

/**
 * Access the enclosing `Timeline`'s coordinate system. Used by header-band
 * overlays and drag handles to position by sample and map pointer → sample.
 * Throws if used outside a `Timeline`.
 */
export function useTimelineCoords(): TimelineCoords {
  const coords = React.useContext(TimelineCoordsContext)
  if (!coords) {
    throw new Error("useTimelineCoords must be used within a <Timeline>")
  }
  return coords
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
 * Fixed height, in pixels, of the playback/timeline toolbar rendered above the
 * timeline surface (see `TimelineToolbar`). Exported here so other editor panes
 * (e.g. the track pane) can reserve matching space and stay vertically aligned
 * with the timeline below the toolbar.
 */
export const TIMELINE_TOOLBAR_HEIGHT = 44

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
 *
 * Exposes its sample ↔ pixel mapping to its subtree via `useTimelineCoords`, and
 * accepts a `headerOverlay` for interactive header-band content (e.g. playback
 * scrubber handles) that needs those coordinates.
 */
function Timeline({
  viewportStart,
  viewportEnd,
  sampleRate,
  playStart,
  playEnd,
  playbackPosition,
  onPan,
  onZoom,
  headerOverlay,
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

  const coords = React.useMemo<TimelineCoords>(() => {
    const perPixel = width > 0 && span > 0 ? span / width : 0
    return {
      viewportStart,
      viewportEnd,
      width,
      samplesPerPixel: perPixel,
      sampleToX: (sample) =>
        perPixel > 0 ? (sample - viewportStart) / perPixel : 0,
      samplesToWidth: (samples) => (perPixel > 0 ? samples / perPixel : 0),
      xToSample: (x) => viewportStart + x * perPixel,
      clientXToSample: (clientX) => {
        const left = containerRef.current?.getBoundingClientRect().left ?? 0
        return viewportStart + (clientX - left) * perPixel
      },
    }
  }, [viewportStart, viewportEnd, width, span])

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
      <div className="pointer-events-none absolute inset-0">
        <TimelinePlayhead
          viewportStart={viewportStart}
          viewportEnd={viewportEnd}
          headerHeight={TIMELINE_HEADER_HEIGHT}
          playStart={playStart}
          playEnd={playEnd}
          playbackPosition={playbackPosition}
        />
      </div>
      <TimelineCoordsContext.Provider value={coords}>
        {/* Header band: interactive overlays (scrubber handles) sit here. The
            band ignores pointer events so empty space still pans; handles
            re-enable them with `pointer-events-auto`. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{ height: TIMELINE_HEADER_HEIGHT }}
        >
          {headerOverlay}
        </div>
        <div
          className="absolute inset-x-0 bottom-0"
          style={{ top: TIMELINE_HEADER_HEIGHT }}
        >
          {children}
        </div>
      </TimelineCoordsContext.Provider>
    </div>
  )
}

export { Timeline }
