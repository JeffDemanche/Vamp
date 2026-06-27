import * as React from "react"

import { cn } from "@/lib/utils"

type TrackInfoProps = {
  /** The track's display name. */
  name: string
  className?: string
}

/**
 * A single row in the timeline's track pane summarizing one track. Pure
 * presentational composite: all of its state (currently just the track name)
 * arrives through props. Future controls (mute/solo, rename, etc.) will be
 * added here and surfaced as callbacks.
 */
function TrackInfo({ name, className }: TrackInfoProps) {
  return (
    <div
      data-slot="track-info"
      className={cn(
        "flex h-14 items-center gap-2 rounded-md border border-border bg-card px-3",
        className,
      )}
    >
      <span className="truncate text-sm font-medium text-foreground">
        {name}
      </span>
    </div>
  )
}

export { TrackInfo }
