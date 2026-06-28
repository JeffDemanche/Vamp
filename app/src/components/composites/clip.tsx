import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const clipVariants = cva(
  // Base: a clip fills the box its parent positions on the timeline and shares
  // one set of interactive affordances across every variant — pointer cursor, a
  // hover highlight, a pressed nudge, and a focus ring — plus a `data-selected`
  // ring for the active/selected clip, so clips feel uniform wherever they live.
  "group/clip relative flex h-full w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-md border text-left outline-none transition-[color,background-color,border-color,box-shadow] select-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px data-[selected=true]:ring-2",
  {
    variants: {
      variant: {
        standard:
          "border-border bg-card text-card-foreground hover:border-ring/60 hover:bg-accent data-[selected=true]:border-primary data-[selected=true]:ring-primary",
        recording:
          "animate-pulse border-destructive/70 bg-destructive/15 text-foreground hover:bg-destructive/25 data-[selected=true]:border-destructive data-[selected=true]:ring-destructive",
      },
    },
    defaultVariants: {
      variant: "standard",
    },
  },
)

type ClipProps = Omit<React.ComponentProps<"div">, "children"> &
  VariantProps<typeof clipVariants> & {
    /** Display name shown in the clip's header bar. */
    label?: string
    /** Marks this clip as the active/selected one (adds a highlight ring). */
    selected?: boolean
    /** Body content, e.g. a future waveform rendered beneath the header. */
    children?: React.ReactNode
  }

/**
 * A clip on the timeline. Pure presentational composite: every bit of state —
 * which `variant` it is, its `label`, whether it's `selected`, and any pointer
 * handlers for selection/drag — arrives through props; the owning feature is
 * responsible for absolutely positioning it (left/width from the clip's sample
 * `start`/`duration`) within a timeline lane.
 *
 * Two variants for now: `standard` (a placed clip) and `recording` (a clip
 * actively being recorded, tinted destructive and pulsing). Both share the same
 * hover / focus / pressed / selected affordances since clips are interactive.
 */
function Clip({
  variant = "standard",
  label,
  selected = false,
  className,
  children,
  role = "button",
  tabIndex = 0,
  ...props
}: ClipProps) {
  return (
    <div
      data-slot="clip"
      data-variant={variant}
      data-selected={selected}
      role={role}
      tabIndex={tabIndex}
      aria-pressed={selected}
      className={cn(clipVariants({ variant }), className)}
      {...props}
    >
      <div className="flex items-center gap-1.5 px-2 py-1">
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
      {children && <div className="min-h-0 flex-1">{children}</div>}
    </div>
  )
}

export { Clip, clipVariants }
