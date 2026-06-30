import { cva, type VariantProps } from "class-variance-authority"

/**
 * The one selection styling pattern shared by interactive timeline surfaces
 * (track rows, clips). It governs colour, border, and interaction states only —
 * each element supplies its own layout (size, flex, padding) — and keys the
 * selected look off a `data-selected` boolean attribute.
 *
 * The pattern, rather than ringing the element, recolours it with its own
 * scheme: an unselected surface is a subtle, surface-tinted version of the
 * scheme; a selected surface is filled with the scheme's full colour and its
 * matching foreground. Each scheme therefore owns a complete unselected →
 * selected colour story, so selection reads as the element "lighting up" in its
 * own colour instead of gaining a border ring.
 *
 * - `neutral` — the default surface (cards/clips): card → primary fill.
 * - `destructive` — destructive-tinted surfaces (the live recording clip):
 *   faint destructive tint → solid destructive fill.
 *
 * `interactive` gates the affordances that only make sense when a surface can
 * actually be selected (pointer cursor, hover shift, keyboard focus ring).
 */
export const selectableSurface = cva(
  "rounded-md border outline-none transition-[color,background-color,border-color] select-none",
  {
    variants: {
      scheme: {
        neutral:
          "border-border bg-card text-card-foreground data-[selected=true]:border-primary data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground",
        destructive:
          "border-destructive/70 bg-destructive/15 text-foreground data-[selected=true]:border-destructive data-[selected=true]:bg-destructive data-[selected=true]:text-white",
      },
      interactive: {
        true: "cursor-pointer focus-visible:ring-2 focus-visible:ring-ring",
        false: "",
      },
    },
    compoundVariants: [
      {
        scheme: "neutral",
        interactive: true,
        // Hover lifts an unselected surface toward the accent; a selected
        // surface stays on its full primary fill rather than washing out.
        class:
          "hover:bg-accent hover:text-accent-foreground data-[selected=true]:hover:bg-primary data-[selected=true]:hover:text-primary-foreground",
      },
      {
        scheme: "destructive",
        interactive: true,
        class:
          "hover:bg-destructive/25 data-[selected=true]:hover:bg-destructive data-[selected=true]:hover:text-white",
      },
    ],
    defaultVariants: {
      scheme: "neutral",
      interactive: true,
    },
  },
)

export type SelectableSurfaceVariants = VariantProps<typeof selectableSurface>
