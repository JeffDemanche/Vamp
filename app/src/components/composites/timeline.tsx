import * as React from "react"

import { cn } from "@/lib/utils"

type TimelineProps = {
  className?: string
} & React.ComponentProps<"div">

/**
 * Placeholder for the horizontal editing timeline. Currently a stub that fills
 * its container and shows where tracks and regions will eventually render.
 *
 * Pure presentational composite — it holds no state and is domain-agnostic.
 */
function Timeline({ className, ...props }: TimelineProps) {
  return (
    <div
      data-slot="timeline"
      role="region"
      aria-label="Timeline"
      className={cn(
        "flex h-full w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground",
        className,
      )}
      {...props}
    >
      Timeline coming soon
    </div>
  )
}

export { Timeline }
