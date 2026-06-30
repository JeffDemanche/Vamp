import * as React from "react"

import { stackedLayerCount } from "@/audio/AudioEngine"
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
 * For a **stacked** clip the underlying recording holds several loop passes
 * overlaid within the clip's single loop region (matching the **AudioEngine**'s
 * stacked scheduling): one waveform layer is drawn per pass, each reading the
 * slice at that pass's exact buffer offset (`audioOffset + k * loopLength`) and
 * overlaid in the same clip body so the layers read as stacked. Each layer's
 * alpha is divided by the layer count so the overlaid stack reads at roughly a
 * flat clip's opacity. Flat clips draw a single layer.
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
  mode,
  loopLength,
  selected,
  hovered,
}: {
  audioId: string
  /** Sample offset into the source audio where the clip's window begins. */
  audioOffset: number
  /** Clip length, in samples — the width of the audio window shown. */
  duration: number
  /** How the clip schedules its audio (`FLAT` or `STACKED`). */
  mode: string
  /** Loop length (samples) for stacked clips; `null`/`0` for flat clips. */
  loopLength?: number | null
  selected: boolean
  hovered: boolean
}) {
  const buffer = useAudioBuffer(audioId)
  const { sampleRate } = useTimelineViewport()

  // One peaks array per stacked loop pass (just one for a flat clip), each
  // offset into the recording by that pass's buffer offset so the layers line
  // up with the engine's stacked audio events.
  const layers = React.useMemo(() => {
    if (!buffer) return null
    const stacked = mode === "STACKED" && loopLength != null && loopLength > 0
    const count = stacked
      ? stackedLayerCount(buffer.duration * sampleRate, loopLength)
      : 1
    return Array.from({ length: count }, (_, k) =>
      computeClipPeaks(buffer, audioOffset + k * (loopLength ?? 0), duration),
    )
  }, [buffer, audioOffset, duration, mode, loopLength, sampleRate])

  // Split the base alpha across the stacked layers so their overlaid sum reads
  // at roughly the opacity of a flat clip's single waveform (a flat clip has
  // one layer, so its colour is unchanged).
  const layerCount = layers?.length ?? 1
  const waveColor = React.useMemo(() => {
    if (selected)
      return resolveWaveColor("--primary-foreground", WAVE_ALPHA.selected / layerCount)
    if (hovered)
      return resolveWaveColor("--accent-foreground", WAVE_ALPHA.hovered / layerCount)
    return resolveWaveColor("--foreground", WAVE_ALPHA.default / layerCount)
  }, [selected, hovered, layerCount])

  if (!layers) return null

  const seconds = duration / sampleRate

  if (layers.length === 1) {
    return <Waveform peaks={layers[0]} duration={seconds} waveColor={waveColor} />
  }

  return (
    <div className="relative h-full w-full">
      {layers.map((peaks, k) => (
        <div key={k} className="absolute inset-0">
          <Waveform peaks={peaks} duration={seconds} waveColor={waveColor} />
        </div>
      ))}
    </div>
  )
}
