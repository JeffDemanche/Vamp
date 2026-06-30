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
  /**
   * Live playback position (sample) of the audio engine, drawn as a moving
   * full-height playhead line. Null when playback is stopped (nothing drawn).
   */
  playbackPosition?: number | null
  className?: string
}

/**
 * Size (px) of the small caret flag at the top of each scrubber. Smaller than a
 * full triangle so the marker reads as a subtle slider handle; also bounds the
 * caret's width (it leans `CARET_SIZE` px to one side).
 */
const CARET_SIZE = 7

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
 * Canvas overlay that draws the timeline's playback-range scrubbers: a small
 * caret leaning right at `playStart` and, when set, a caret leaning left at
 * `playEnd`. Each caret sits at the very top of the header band and is joined to
 * a thin guide line that runs the full height of the timeline (header included),
 * so the marker and its line read as one continuous scrubber. When `playEnd` is
 * null, only the start scrubber is drawn.
 *
 * While the audio engine is playing, `playbackPosition` adds a third marker: a
 * solid, full-height playhead line tracking the live playback position, drawn
 * in `--destructive` so it reads distinctly from the static range scrubbers.
 *
 * Pure presentational primitive: the play range, live position, and visible
 * window arrive as props; the only internal state is the canvas's measured size
 * and the imperative draw. Theme colors (`--primary` for start,
 * `--secondary-foreground` for end, `--destructive` for the live playhead) are
 * resolved from the element's own computed style.
 */
function TimelinePlayhead({
  viewportStart,
  viewportEnd,
  headerHeight,
  playStart,
  playEnd,
  playbackPosition,
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
     * Draw one scrubber: a guide line spanning the *whole* timeline (header band
     * included) so it joins seamlessly to the caret at the top with no gap, plus
     * a small right-angle caret hugging the line. `direction` is +1 for the start
     * scrubber (caret leans right, toward the play region) and -1 for the end
     * scrubber (caret leans left), so the two stay distinguishable.
     */
    const drawScrubber = (sample: number, color: string, direction: 1 | -1) => {
      const x = xForSample(sample)
      // Skip markers that fall outside the visible window (with a little slack).
      if (x < -CARET_SIZE || x > width + CARET_SIZE) return

      const lineX = Math.round(x) + 0.5
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      ctx.moveTo(lineX, 0)
      ctx.lineTo(lineX, height)
      ctx.stroke()

      const caret = Math.min(CARET_SIZE, headerHeight)
      ctx.globalAlpha = 1
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(lineX, 0)
      ctx.lineTo(lineX + direction * caret, 0)
      ctx.lineTo(lineX, caret)
      ctx.closePath()
      ctx.fill()
    }

    drawScrubber(playStart, startColor, 1)
    if (playEnd !== null) drawScrubber(playEnd, endColor, -1)

    // Live playhead: a solid full-height line at the current playback position.
    if (playbackPosition != null) {
      const x = xForSample(playbackPosition)
      if (x >= 0 && x <= width) {
        const playheadColor = readCssVar(canvas, "--destructive", "currentColor")
        const lineX = Math.round(x) + 0.5
        ctx.strokeStyle = playheadColor
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(lineX, 0)
        ctx.lineTo(lineX, height)
        ctx.stroke()
      }
    }

    ctx.globalAlpha = 1
  }, [
    ref,
    width,
    height,
    viewportStart,
    viewportEnd,
    headerHeight,
    playStart,
    playEnd,
    playbackPosition,
  ])

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
