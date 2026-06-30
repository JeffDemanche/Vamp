import * as React from "react"

import { useAudioBuffer } from "@/audio/AudioEngineProvider"
import { computeClipPeaks } from "@/audio/waveformPeaks"
import { Waveform } from "@/components/primitives/waveform"
import { useTimelineViewport } from "@/state/timeline"

/**
 * How visible the waveform is in each clip state, as a percentage mixed toward
 * transparent. Selected/hover clips recolour their whole surface (see
 * `selectableSurface`), so the waveform switches to the matching foreground
 * token and leans more opaque to stay legible on the filled background.
 */
const WAVE_ALPHA = { default: 38, hovered: 55, selected: 85 } as const

/**
 * Resolve a theme colour token (a CSS custom property like `--foreground`) to a
 * concrete colour string, mixed toward transparent by `alphaPercent`. wavesurfer
 * paints onto a canvas, where `var(...)` and `currentColor` don't resolve, so we
 * read the computed value off the document root and bake the alpha in via
 * `color-mix`. Falls back to a neutral grey if the token can't be read.
 */
function resolveWaveColor(token: string, alphaPercent: number): string {
  const root = typeof document !== "undefined" ? document.documentElement : null
  const value = root
    ? getComputedStyle(root).getPropertyValue(token).trim()
    : ""
  const base = value || "oklch(0.55 0 0)"
  return `color-mix(in oklab, ${base} ${alphaPercent}%, transparent)`
}

/**
 * The waveform drawn in the background of a placed clip. Pulls the clip's source
 * audio straight from the {@link useAudioBuffer engine's decoded buffer} (no
 * re-fetch), reduces the clip's `[audioOffset, audioOffset + duration)` window
 * to peaks, and hands them to the pure {@link Waveform} primitive.
 *
 * Renders nothing until the buffer has downloaded/decoded, so the clip shows its
 * plain surface first and the waveform fades in once bytes land. Its colour
 * tracks the clip's `selected`/`hovered` state to match the shared selection
 * styling — foreground-on-fill when lit up, a subtle tint otherwise.
 *
 * Mount inside an `AudioEngineProvider` (for the buffer) and a timeline editor
 * (for the sample rate). Times are in samples (see `AGENTS.md`).
 */
export function ClipWaveform({
  audioId,
  audioOffset,
  duration,
  selected,
  hovered,
}: {
  audioId: string
  /** Sample offset into the source audio where the clip's window begins. */
  audioOffset: number
  /** Clip length, in samples — the width of the audio window shown. */
  duration: number
  selected: boolean
  hovered: boolean
}) {
  const buffer = useAudioBuffer(audioId)
  const { sampleRate } = useTimelineViewport()

  const peaks = React.useMemo(
    () => (buffer ? computeClipPeaks(buffer, audioOffset, duration) : null),
    [buffer, audioOffset, duration],
  )

  const waveColor = React.useMemo(() => {
    if (selected) return resolveWaveColor("--primary-foreground", WAVE_ALPHA.selected)
    if (hovered) return resolveWaveColor("--accent-foreground", WAVE_ALPHA.hovered)
    return resolveWaveColor("--foreground", WAVE_ALPHA.default)
  }, [selected, hovered])

  if (!peaks) return null

  return (
    <Waveform peaks={peaks} duration={duration / sampleRate} waveColor={waveColor} />
  )
}
