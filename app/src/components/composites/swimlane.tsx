import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Fixed height, in pixels, of a single track swimlane. Mirrors the `TrackInfo`
 * row height (`h-14`) so each lane lines up with its track's row in the
 * `TrackPane`; the two must change together.
 */
export const SWIMLANE_HEIGHT = 56

/**
 * Vertical gap, in pixels, between stacked swimlanes. Matches the `TrackPane`'s
 * `gap-2` so lanes and `TrackInfo` rows stay in vertical lockstep.
 */
export const SWIMLANE_GAP = 8

/**
 * The coordinate system a `Swimlane` exposes to its children: the visible
 * sample window and the conversions between timeline sample positions and pixel
 * offsets within the lane. Derived from the lane's measured pixel width and the
 * `viewportStart`/`viewportEnd` props, so positions track pan/zoom automatically.
 */
export type SwimlaneCoords = {
  /** Sample coordinate at the lane's left edge. May be negative. */
  viewportStart: number
  /** Sample coordinate at the lane's right edge. May be negative. */
  viewportEnd: number
  /** Measured lane width in CSS pixels (0 before first measurement). */
  width: number
  /** Samples represented by a single pixel (0 before first measurement). */
  samplesPerPixel: number
  /** Convert a sample position to an x offset (px) from the lane's left edge. */
  sampleToX: (sample: number) => number
  /** Convert a sample duration to a width (px) within the lane. */
  samplesToWidth: (samples: number) => number
  /** Convert an x offset (px) from the lane's left edge back to a sample position. */
  xToSample: (x: number) => number
}

const SwimlaneCoordsContext = React.createContext<SwimlaneCoords | null>(null)

/**
 * Access the enclosing `Swimlane`'s coordinate system. Children use this to
 * position themselves by sample position rather than raw pixels. Throws if used
 * outside a `Swimlane`.
 */
export function useSwimlaneCoords(): SwimlaneCoords {
  const coords = React.useContext(SwimlaneCoordsContext)
  if (!coords) {
    throw new Error("useSwimlaneCoords must be used within a <Swimlane>")
  }
  return coords
}

type SwimlaneProps = {
  /** Sample coordinate at the lane's left edge (the timeline viewport start). */
  viewportStart: number
  /** Sample coordinate at the lane's right edge (the timeline viewport end). */
  viewportEnd: number
  /** Positioned lane content (e.g. `SwimlaneItem`s / clips). */
  children?: React.ReactNode
  className?: string
}

/**
 * A single track's horizontal lane on the timeline. Spans the full width of the
 * timeline viewport and aligns vertically with the track's `TrackInfo` row.
 *
 * Establishes a sample → pixel coordinate system for its children: it measures
 * its own pixel width and, combined with the `viewportStart`/`viewportEnd`
 * props, derives a `SwimlaneCoords` exposed via context (`useSwimlaneCoords`).
 * Children positioned with `SwimlaneItem` (or by reading the context directly)
 * stay pinned to their sample positions as the viewport pans and zooms.
 *
 * Pure presentational composite: the visible sample range arrives via props and
 * the only internal state is the measured width.
 */
function Swimlane({
  viewportStart,
  viewportEnd,
  children,
  className,
}: SwimlaneProps) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = React.useState(0)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const coords = React.useMemo<SwimlaneCoords>(() => {
    const span = viewportEnd - viewportStart
    const samplesPerPixel = width > 0 && span > 0 ? span / width : 0
    return {
      viewportStart,
      viewportEnd,
      width,
      samplesPerPixel,
      sampleToX: (sample) =>
        samplesPerPixel > 0 ? (sample - viewportStart) / samplesPerPixel : 0,
      samplesToWidth: (samples) =>
        samplesPerPixel > 0 ? samples / samplesPerPixel : 0,
      xToSample: (x) => viewportStart + x * samplesPerPixel,
    }
  }, [viewportStart, viewportEnd, width])

  return (
    <SwimlaneCoordsContext.Provider value={coords}>
      <div
        ref={ref}
        data-slot="swimlane"
        // `h-14` matches SWIMLANE_HEIGHT / the TrackInfo row height.
        className={cn(
          "relative h-14 w-full overflow-hidden rounded-md bg-foreground/5",
          className,
        )}
      >
        {children}
      </div>
    </SwimlaneCoordsContext.Provider>
  )
}

type SwimlaneItemProps = {
  /** Sample position of the item's left edge. */
  start: number
  /**
   * Sample duration; when provided the item is given a matching pixel width.
   * Omit for zero-width markers that only need an x position.
   */
  duration?: number
  children?: React.ReactNode
  className?: string
}

/**
 * Absolutely positions its children within the enclosing `Swimlane` according
 * to a sample `start` (and optional sample `duration`), reading the lane's
 * `useSwimlaneCoords` to convert samples → pixels. Fills the lane vertically.
 */
function SwimlaneItem({
  start,
  duration,
  children,
  className,
}: SwimlaneItemProps) {
  const { sampleToX, samplesToWidth } = useSwimlaneCoords()
  const style: React.CSSProperties = { left: sampleToX(start) }
  if (duration != null) style.width = samplesToWidth(duration)

  return (
    <div
      data-slot="swimlane-item"
      className={cn("absolute inset-y-0", className)}
      style={style}
    >
      {children}
    </div>
  )
}

export { Swimlane, SwimlaneItem }
