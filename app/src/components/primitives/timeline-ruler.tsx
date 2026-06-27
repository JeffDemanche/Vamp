import * as React from "react"

import { cn } from "@/lib/utils"

type TimelineRulerProps = {
  /** Sample coordinate at the left edge of the ruler. May be negative. */
  viewportStart: number
  /** Sample coordinate at the right edge of the ruler. May be negative. */
  viewportEnd: number
  /** Samples per second used to convert sample coordinates to time. */
  sampleRate: number
  className?: string
}

/**
 * "Nice" tick intervals, in seconds, used to pick a tick/label cadence that
 * keeps a sensible on-screen spacing as the viewport zooms.
 */
const NICE_SECOND_STEPS = [
  1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 21600, 43200,
] as const

/** Pick the smallest nice step whose on-screen spacing is at least `minPx`. */
function chooseStepSeconds(pixelsPerSecond: number, minPx: number): number {
  for (const step of NICE_SECOND_STEPS) {
    if (step * pixelsPerSecond >= minPx) return step
  }
  return NICE_SECOND_STEPS[NICE_SECOND_STEPS.length - 1]
}

/** Format a (possibly negative, possibly fractional) second count as a label. */
function formatTimestamp(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? "-" : ""
  const abs = Math.abs(Math.round(totalSeconds))
  const hours = Math.floor(abs / 3600)
  const minutes = Math.floor((abs % 3600) / 60)
  const seconds = abs % 60
  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, "0")
  const ss = String(seconds).padStart(2, "0")
  return hours > 0 ? `${sign}${hours}:${mm}:${ss}` : `${sign}${mm}:${ss}`
}

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

/**
 * Canvas-based background ruler for the timeline. Renders second ticks and
 * periodic timestamp labels for the visible sample range, sitting underneath
 * everything else on the timeline.
 *
 * Pure presentational primitive: the visible range and sample rate arrive as
 * props; the only internal state is the canvas's own measured size and the
 * imperative draw, which are presentation details.
 */
function TimelineRuler({
  viewportStart,
  viewportEnd,
  sampleRate,
  className,
}: TimelineRulerProps) {
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
    const pixelsPerSecond = sampleRate / samplesPerPixel
    const startSeconds = viewportStart / sampleRate
    const endSeconds = viewportEnd / sampleRate

    // Minor ticks every second when there's room, otherwise thin out; labelled
    // major ticks get more breathing room so text never collides.
    const minorStep = chooseStepSeconds(pixelsPerSecond, 7)
    const labelStep = chooseStepSeconds(pixelsPerSecond, 64)

    const color = getComputedStyle(canvas).color || "#888"
    const xForSecond = (seconds: number) =>
      (seconds * sampleRate - viewportStart) / samplesPerPixel

    // Minor ticks: short marks at the top + faint full-height gridlines.
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    const firstMinor = Math.ceil(startSeconds / minorStep) * minorStep
    for (let s = firstMinor; s <= endSeconds; s += minorStep) {
      const x = Math.round(xForSecond(s)) + 0.5
      ctx.globalAlpha = 0.12
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()

      ctx.globalAlpha = 0.4
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, 6)
      ctx.stroke()
    }

    // Major ticks: taller marks, stronger gridlines, and timestamp labels.
    ctx.textBaseline = "top"
    ctx.textAlign = "left"
    const firstMajor = Math.ceil(startSeconds / labelStep) * labelStep
    for (let s = firstMajor; s <= endSeconds; s += labelStep) {
      const x = Math.round(xForSecond(s)) + 0.5
      // Emphasize the origin (0s) so it stands out from the other markers.
      const isOrigin = Math.round(s) === 0

      ctx.lineWidth = isOrigin ? 1.5 : 1
      ctx.globalAlpha = isOrigin ? 0.45 : 0.28
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()

      ctx.globalAlpha = isOrigin ? 1 : 0.7
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, isOrigin ? 13 : 11)
      ctx.stroke()
      ctx.lineWidth = 1

      ctx.font = isOrigin
        ? "bold 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
        : "10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
      ctx.globalAlpha = isOrigin ? 1 : 0.9
      ctx.fillStyle = color
      ctx.fillText(formatTimestamp(s), x + 3, 12)
    }

    ctx.globalAlpha = 1
  }, [ref, width, height, viewportStart, viewportEnd, sampleRate])

  return (
    <canvas
      ref={ref}
      data-slot="timeline-ruler"
      aria-hidden
      className={cn("block h-full w-full text-muted-foreground", className)}
    />
  )
}

export { TimelineRuler }
