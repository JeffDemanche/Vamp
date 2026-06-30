import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { selectableSurface } from "@/lib/selectable"

const clipVariants = cva(
  // Layout + per-variant flourishes only; colour, border, hover/focus, and the
  // selected look come from the shared `selectableSurface` pattern so clips and
  // track rows select identically.
  "group/clip relative flex h-full w-full min-w-0 flex-col overflow-hidden text-left active:translate-y-px",
  {
    variants: {
      variant: {
        standard: "",
        recording: "animate-pulse",
      },
    },
    defaultVariants: {
      variant: "standard",
    },
  },
)

type ClipProps = Omit<React.ComponentProps<"div">, "children" | "onSelect"> &
  VariantProps<typeof clipVariants> & {
    /** Display name shown in the clip's header bar. */
    label?: string
    /** Marks this clip as the active/selected one. */
    selected?: boolean
    /**
     * Called when the user activates the clip to select it (click or
     * Enter/Space). Receives the originating event so callers can read modifier
     * keys (e.g. ⌘/Ctrl for additive selection). When omitted the clip is
     * non-interactive (no selection affordances), e.g. the live recording clip.
     */
    onSelect?: (event: React.MouseEvent | React.KeyboardEvent) => void
    /**
     * Background content filling the clip, drawn behind the header label (e.g.
     * a waveform). Stretched to the clip's bounds and pointer-inert so it never
     * intercepts the clip's selection/drag gestures.
     */
    children?: React.ReactNode
  }

/**
 * A clip on the timeline. Pure presentational composite: every bit of state —
 * which `variant` it is, its `label`, whether it's `selected`, and the
 * `onSelect` handler — arrives through props; the owning feature is
 * responsible for absolutely positioning it (left/width from the clip's sample
 * `start`/`duration`) within a timeline lane.
 *
 * Two variants for now: `standard` (a placed clip) and `recording` (a clip
 * actively being recorded, tinted destructive and pulsing). Both select through
 * the shared `selectableSurface` pattern — recolouring to their full scheme
 * when selected rather than gaining a ring — so clips and track rows feel like
 * one selection system.
 */
function Clip({
  variant = "standard",
  label,
  selected = false,
  onSelect,
  className,
  children,
  onPointerDown,
  ...props
}: ClipProps) {
  const interactive = !!onSelect

  return (
    <div
      data-slot="clip"
      data-variant={variant}
      data-selected={selected}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      onClick={onSelect}
      onPointerDown={
        interactive
          ? (event) => {
              // Keep the click on its way to selecting this clip: the enclosing
              // timeline starts a pan/drag (and captures the pointer) on
              // pointer-down, which would otherwise swallow the selection click.
              event.stopPropagation()
              onPointerDown?.(event)
            }
          : onPointerDown
      }
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onSelect?.(event)
              }
            }
          : undefined
      }
      className={cn(
        selectableSurface({
          scheme: variant === "recording" ? "destructive" : "neutral",
          interactive,
        }),
        clipVariants({ variant }),
        className,
      )}
      {...props}
    >
      {children && (
        <div
          data-slot="clip-body"
          className="pointer-events-none absolute inset-0"
        >
          {children}
        </div>
      )}
      <div className="relative flex items-center gap-1.5 px-2 py-1">
        {variant === "recording" && (
          <span
            className="size-2 shrink-0 rounded-full bg-destructive"
            aria-hidden
          />
        )}
        {label && (
          <span className="truncate text-xs leading-none font-medium">
            {label}
          </span>
        )}
      </div>
    </div>
  )
}

export { Clip, clipVariants }
