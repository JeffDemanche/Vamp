import * as React from "react"

import { resolveScheduledEvent, type AudioInClipSpec } from "@vamp/shared"
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
 * re-fetch), reduces each {@link AudioInClipSpec}'s effective window to peaks,
 * and hands them to the pure {@link Waveform} primitive.
 *
 * For a **stacked** clip one waveform layer is drawn per baked `AudioInClip`,
 * intersected with the clip trim envelope so trimmed clips truncate each layer
 * at the clip end. Flat clips draw a single layer.
 *
 * Renders nothing until the buffer has downloaded/decoded, so the clip shows its
 * plain surface first and the waveform fades in once bytes land.
 */
export function ClipWaveform({
  audioId,
  buffer: bufferOverride,
  clipStart,
  clipDuration,
  audioInClips,
  selected,
  hovered,
  variant = "standard",
}: {
  audioId?: string
  /** When set, draws from this buffer instead of fetching `audioId` from the engine. */
  buffer?: AudioBuffer | null
  /** Clip trim envelope start (timeline samples). */
  clipStart: number
  /** Clip trim envelope duration (timeline samples). */
  clipDuration: number
  /** Baked dispatched events — one waveform layer per entry. */
  audioInClips: readonly AudioInClipSpec[]
  selected: boolean
  hovered: boolean
  /** Colour scheme for the waveform (`recording` uses destructive tokens). */
  variant?: "standard" | "recording"
}) {
  const bufferFromEngine = useAudioBuffer(bufferOverride ? null : audioId)
  const buffer = bufferOverride ?? bufferFromEngine
  const { sampleRate } = useTimelineViewport()

  const layers = React.useMemo(() => {
    if (!buffer) return null
    const envelope = { start: clipStart, duration: clipDuration }
    return audioInClips.flatMap((aic) => {
      const resolved = resolveScheduledEvent(aic, envelope)
      if (!resolved) return []
      const timelineSamples = resolved.endSample - resolved.startSample
      const offset = resolved.bufferOffset
      const audioSamples = Math.max(
        0,
        Math.min(timelineSamples, buffer.length - offset),
      )
      return [
        {
          peaks: computeClipPeaks(buffer, offset, audioSamples),
          widthFraction:
            clipDuration > 0 ? timelineSamples / clipDuration : 1,
          seconds: audioSamples / sampleRate,
        },
      ]
    })
  }, [buffer, clipStart, clipDuration, audioInClips, sampleRate])

  const layerCount = layers?.length ?? 1
  const waveColor = React.useMemo(() => {
    if (variant === "recording") {
      return resolveWaveColor(
        "--destructive-foreground",
        WAVE_ALPHA.default / layerCount,
      )
    }
    if (selected)
      return resolveWaveColor("--primary-foreground", WAVE_ALPHA.selected / layerCount)
    if (hovered)
      return resolveWaveColor("--accent-foreground", WAVE_ALPHA.hovered / layerCount)
    return resolveWaveColor("--foreground", WAVE_ALPHA.default / layerCount)
  }, [selected, hovered, layerCount, variant])

  if (!layers || layers.length === 0) return null

  if (layers.length === 1) {
    const layer = layers[0]!
    return (
      <WaveformLayer
        peaks={layer.peaks}
        seconds={layer.seconds}
        widthFraction={layer.widthFraction}
        waveColor={waveColor}
      />
    )
  }

  return (
    <div className="relative h-full w-full">
      {layers.map((layer, k) => (
        <div key={k} className="absolute inset-0">
          <WaveformLayer
            peaks={layer.peaks}
            seconds={layer.seconds}
            widthFraction={layer.widthFraction}
            waveColor={waveColor}
          />
        </div>
      ))}
    </div>
  )
}

/** Renders peaks at the correct scale when clip duration exceeds audio length. */
function WaveformLayer({
  peaks,
  seconds,
  widthFraction,
  waveColor,
}: {
  peaks: Float32Array
  seconds: number
  widthFraction: number
  waveColor: string
}) {
  const body = (
    <Waveform peaks={peaks} duration={seconds} waveColor={waveColor} />
  )
  if (widthFraction >= 1) return body
  return (
    <div className="h-full" style={{ width: `${widthFraction * 100}%` }}>
      {body}
    </div>
  )
}
