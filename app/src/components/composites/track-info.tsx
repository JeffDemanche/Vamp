import * as React from "react"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/primitives/button"
import { cn } from "@/lib/utils"

type TrackInfoProps = {
  /** The track's display name. */
  name: string
  /** Whether this track is the active/selected one. */
  selected?: boolean
  /** Called when the user activates the row to select this track. */
  onSelect?: () => void
  /**
   * Called when the user activates the delete control. When omitted, no delete
   * button is shown.
   */
  onDelete?: () => void
  /** Disables the delete control (e.g. while a delete is in flight). */
  deleteDisabled?: boolean
  className?: string
}

/**
 * A single row in the timeline's track pane summarizing one track. Pure
 * presentational composite: all of its state (the track name, whether a delete
 * action is available) arrives through props. The delete control surfaces as a
 * callback so the owning feature performs the mutation. Future controls
 * (mute/solo, rename, etc.) will be added here and surfaced as callbacks too.
 */
function TrackInfo({
  name,
  selected = false,
  onSelect,
  onDelete,
  deleteDisabled,
  className,
}: TrackInfoProps) {
  return (
    <div
      data-slot="track-info"
      data-selected={selected}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-pressed={onSelect ? selected : undefined}
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onSelect()
              }
            }
          : undefined
      }
      className={cn(
        "group/track-info flex h-14 items-center gap-2 rounded-md border border-border bg-card px-3 transition-[border-color,box-shadow]",
        onSelect && "cursor-pointer hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-primary ring-2 ring-primary",
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {name}
      </span>
      {onDelete && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete track ${name}`}
          disabled={deleteDisabled}
          onClick={(event) => {
            event.stopPropagation()
            onDelete()
          }}
          className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover/track-info:opacity-100"
        >
          <Trash2 aria-hidden />
        </Button>
      )}
    </div>
  )
}

export { TrackInfo }
