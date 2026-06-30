import * as React from "react"
import WaveSurfer from "wavesurfer.js"

import { cn } from "@/lib/utils"

type WaveformProps = {
  /**
   * Pre-decoded peaks for a single (mono) channel, each in `-1..1`. Rendered as
   * a continuous waveform and decimated by wavesurfer to the element's pixel
   * width, so it stays crisp at any zoom. Keep this reference stable (memoize
   * it) — a new array re-renders the waveform from scratch.
   */
  peaks: Float32Array | number[]
  /**
   * Length the `peaks` span, in seconds. Only used to scale the render; must be
   * finite and `> 0` (wavesurfer rejects `0`/`Infinity`).
   */
  duration: number
  /** Concrete CSS colour for the waveform fill (resolved — `var(...)` won't paint on canvas). */
  waveColor: string
  className?: string
}

/**
 * Pure presentational waveform: renders the supplied `peaks` to a canvas via
 * `wavesurfer.js`, with no audio loaded (visual only — no fetch, decode, or
 * playback). Every input arrives through props; it holds no app/domain state.
 *
 * Drawn as a continuous waveform (no `barWidth`) so it renders efficiently and
 * reads cleanly at every scale. Stretches to fill its positioned parent, so
 * mount it inside a sized, `relative`/absolute container (e.g. a clip body).
 * Pointer-inert, so it never steals gestures from the surface it backs.
 *
 * wavesurfer paints onto a fixed-width canvas and only re-renders ~100ms after
 * its container stops resizing, so a live zoom would leave the waveform pinned
 * at its old width until the gesture settles. To track the parent smoothly we
 * apply a cheap horizontal `scaleX` to the canvas — stretching the last render
 * to the current width each resize — and drop it the moment wavesurfer paints a
 * fresh, crisp canvas (`redrawcomplete`). The result scales fluidly with the
 * clip during a zoom, then sharpens when it lands.
 *
 * The scale is anchored at the left edge, so on zoom-*out* the fixed-width
 * canvas (still at its larger last-rendered width) is wider than the shrinking
 * container; wavesurfer's own `.scroll` element clips that overflow with
 * `overflow-x: hidden`, cutting the waveform's right side off before the scale
 * can shrink it to fit. We neutralise that inner clip with a stylesheet in
 * wavesurfer's shadow root (durable against its per-render inline reset) so the
 * transform governs the width in both directions; the clip's own
 * `overflow-hidden` stays the real right-edge boundary.
 */
function Waveform({ peaks, duration, waveColor, className }: WaveformProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const wsRef = React.useRef<WaveSurfer | null>(null)

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const ws = WaveSurfer.create({
      container,
      waveColor,
      height: "auto",
      cursorWidth: 0,
      interact: false,
      hideScrollbar: true,
      // Fill the clip body and scale each clip to its own range so quiet takes
      // still read; no `barWidth`/`barGap` → one continuous waveform.
      normalize: true,
    })
    wsRef.current = ws

    // Let the fixed-width canvas overflow its shrunken container during a
    // zoom-out so the left-anchored `scaleX` (below) can size it down to fit
    // instead of being clipped early. Both axes must be `visible`: wavesurfer's
    // `.scroll` keeps `overflow-y: hidden`, and CSS coerces a lone
    // `overflow-x: visible` back to `auto` (which still clips) unless the other
    // axis is visible too. `!important` beats the inline overflow wavesurfer
    // re-applies on every render; the clip's own `overflow-hidden` stays the
    // real bound.
    const root = ws.getWrapper().getRootNode()
    if (root instanceof ShadowRoot) {
      const style = document.createElement("style")
      style.textContent = ".scroll { overflow: visible !important; }"
      root.appendChild(style)
    }

    // The width wavesurfer last painted its canvas at; the baseline the live
    // `scaleX` bridge measures the current width against (null until first paint).
    let renderedWidth: number | null = null
    container.style.transformOrigin = "left center"

    // A fresh canvas just painted at the current width — it's pixel-accurate, so
    // adopt that width as the new baseline and clear any bridging transform.
    const unsubscribe = ws.on("redrawcomplete", () => {
      renderedWidth = container.clientWidth || renderedWidth
      container.style.transform = ""
    })

    // Between wavesurfer's debounced redraws, stretch the existing canvas to the
    // live width so the waveform grows/shrinks in lockstep with the clip.
    const resizeObserver = new ResizeObserver(() => {
      if (!renderedWidth) return
      const width = container.clientWidth
      if (width <= 0) return
      const scale = width / renderedWidth
      container.style.transform =
        Math.abs(scale - 1) < 0.001 ? "" : `scaleX(${scale})`
    })
    resizeObserver.observe(container)

    return () => {
      wsRef.current = null
      resizeObserver.disconnect()
      unsubscribe()
      ws.destroy()
    }
  }, [])

  // Peaks/duration only re-render through `load` (wavesurfer ignores `peaks`
  // passed to `setOptions`); an empty URL keeps it visual-only (no fetch).
  React.useEffect(() => {
    const ws = wsRef.current
    if (!ws) return
    const safeDuration = duration > 0 && Number.isFinite(duration) ? duration : 1
    void ws.load("", [peaks], safeDuration).catch(() => {
      // Loads abort when peaks change quickly or on unmount — safe to ignore.
    })
  }, [peaks, duration])

  React.useEffect(() => {
    wsRef.current?.setOptions({ waveColor })
  }, [waveColor])

  return (
    <div
      ref={containerRef}
      data-slot="waveform"
      aria-hidden
      className={cn("pointer-events-none h-full w-full", className)}
    />
  )
}

export { Waveform }
