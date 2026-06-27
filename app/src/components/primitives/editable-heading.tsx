import * as React from "react"

import { cn } from "@/lib/utils"

type EditableHeadingProps = {
  /** The committed value to display. */
  value: string
  /** Called with the trimmed draft when the user commits a changed value. */
  onCommit: (value: string) => void
  /** Heading element to render in display mode. Defaults to `h1`. */
  as?: "h1" | "h2" | "h3"
  /** Shown (muted) when `value` is empty. */
  placeholder?: string
  /** Accessible label for the edit affordance. */
  editLabel?: string
  /** When true the heading cannot enter edit mode. */
  disabled?: boolean
  className?: string
}

/**
 * A heading that doubles as an inline text field: it renders as a styled
 * heading until activated, then swaps to a same-sized input for editing.
 * Pressing Enter or blurring commits the (trimmed) draft; Escape cancels.
 * Empty drafts are treated as a cancel so the heading never becomes blank.
 *
 * Pure presentational primitive — the committed value and the commit handler
 * arrive through props; only ephemeral edit/draft UI state lives here.
 */
function EditableHeading({
  value,
  onCommit,
  as: Heading = "h1",
  placeholder = "Untitled",
  editLabel = "Edit title",
  disabled = false,
  className,
}: EditableHeadingProps) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(value)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const sharedClasses =
    "w-full max-w-full truncate text-3xl font-bold tracking-tight text-foreground"

  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  function startEditing() {
    if (disabled) return
    setDraft(value)
    setEditing(true)
  }

  function commit() {
    setEditing(false)
    const next = draft.trim()
    if (next.length > 0 && next !== value) {
      onCommit(next)
    }
  }

  function cancel() {
    setEditing(false)
    setDraft(value)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        data-slot="editable-heading-input"
        aria-label={editLabel}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            commit()
          } else if (event.key === "Escape") {
            event.preventDefault()
            cancel()
          }
        }}
        className={cn(
          sharedClasses,
          "rounded-md border border-input bg-transparent px-1 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          className,
        )}
      />
    )
  }

  return (
    <Heading data-slot="editable-heading" className={cn(sharedClasses, className)}>
      <button
        type="button"
        onClick={startEditing}
        disabled={disabled}
        aria-label={editLabel}
        className={cn(
          "block w-full max-w-full cursor-text truncate rounded-md border border-transparent px-1 text-left outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          !disabled && "hover:border-input",
          value.length === 0 && "text-muted-foreground",
        )}
      >
        {value.length > 0 ? value : placeholder}
      </button>
    </Heading>
  )
}

export { EditableHeading }
