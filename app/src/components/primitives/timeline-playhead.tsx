import * as React from "react"

import { cn } from "@/lib/utils"

type TimelinePlayheadProps = {
  /** Sample coordinate at the left edge of the timeline. May be negative. */
  viewportStart: number
  /** Sample coordinate at the right edge of the timeline. May be negative. */
  viewportEnd: number
  /**
   * Height, in pixels, of the timeline header band along the top where the
   * scrubber triangles are drawn (matches `TIMELINE_HEADER_HEIGHT`).
   */
  headerHeight: number
  /** Sample position where playback begins. */
  playStart: number
  /** Sample position where playback ends/loops, or null to play indefinitely. */
  playEnd: number | null
  className?: string
}

/** Triangle height (px) — also bounds its width — for the scrubber markers. */
const TRIANGLE_SIZE = 12

/** Track the rendered (CSS-pixel) size of an element via a `ResizeObserver`. */
function useElementSize() {
  const ref = React.useRef<HTMLCanvasElement | null>(null)
  const [size, setSize] = React.useState({ width: 0, height: 0 })

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, ...size }
}

/** Resolve a CSS custom property off an element, falling back to `fallback`. */
function readCssVar(el: Element, name: string, fallback: string): string {
  const value = getComputedStyle(el).getPropertyValue(name).trim()
  return value || fallback
}

/**
 * Canvas overlay that draws the timeline's playback-range scrubbers: a
 * forward-facing (right-pointing) triangle at `playStart` and, when set, a
 * backward-facing (left-pointing) triangle at `playEnd`. Each triangle sits in
 * the header band and drops a thin full-height guide line at its sample
 * position. When `playEnd` is null, only the start scrubber is drawn.
 *
 * Pure presentational primitive: the play range and visible window arrive as
 * props; the only internal state is the canvas's measured size and the
 * imperative draw. Theme colors (`--primary` for start, `--secondary-foreground`
 * for end) are resolved from the element's own computed style.
 */
function TimelinePlayhead({
  viewportStart,
  viewportEnd,
  headerHeight,
  playStart,
  playEnd,
  className,
}: TimelinePlayheadProps) {
  const { ref, width, height } = useElementSize()

  React.useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const span = viewportEnd - viewportStart
    if (width <= 0 || height <= 0 || span <= 0) return

    const samplesPerPixel = span / width
    const xForSample = (sample: number) => (sample - viewportStart) / samplesPerPixel

    const startColor = readCssVar(canvas, "--primary", "currentColor")
    const endColor = readCssVar(canvas, "--secondary-foreground", "currentColor")

    /**
     * Draw one scrubber: a full-height guide line plus a triangle in the header
     * band. `direction` is +1 for a forward (right-pointing) triangle and -1 for
     * a backward (left-pointing) one; the triangle's flat edge sits on `x`.
     */
    const drawScrubber = (sample: number, color: string, direction: 1 | -1) => {
      const x = xForSample(sample)
      // Skip markers that fall outside the visible window (with a little slack).
      if (x < -TRIANGLE_SIZE || x > width + TRIANGLE_SIZE) return

      const lineX = Math.round(x) + 0.5
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      ctx.moveTo(lineX, headerHeight)
      ctx.lineTo(lineX, height)
      ctx.stroke()

      const triH = Math.min(TRIANGLE_SIZE, headerHeight)
      ctx.globalAlpha = 1
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, triH)
      ctx.lineTo(x + direction * TRIANGLE_SIZE, triH / 2)
      ctx.closePath()
      ctx.fill()
    }

    drawScrubber(playStart, startColor, 1)
    if (playEnd !== null) drawScrubber(playEnd, endColor, -1)

    ctx.globalAlpha = 1
  }, [ref, width, height, viewportStart, viewportEnd, headerHeight, playStart, playEnd])

  return (
    <canvas
      ref={ref}
      data-slot="timeline-playhead"
      aria-hidden
      className={cn("block h-full w-full", className)}
    />
  )
}

export { TimelinePlayhead }
