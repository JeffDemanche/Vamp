import type * as React from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/primitives/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/primitives/dialog"

/**
 * A reusable, pure confirmation dialog: a title, an optional description, and a
 * cancel/confirm pair of buttons. All state arrives via props — the caller owns
 * the open state, supplies the copy, and handles `onConfirm` (including any
 * async work, reflected back through `pending`). Use it to guard destructive or
 * otherwise consequential actions.
 */
export type ConfirmDialogProps = {
  /** Whether the dialog is shown. */
  open: boolean
  /** Called when the open state should change (overlay/escape/cancel/close). */
  onOpenChange: (open: boolean) => void
  /** Heading describing the action. */
  title: string
  /** Optional supporting copy explaining the consequence. */
  description?: React.ReactNode
  /** Confirm button label. Defaults to "Confirm". */
  confirmLabel?: string
  /** Cancel button label. Defaults to "Cancel". */
  cancelLabel?: string
  /** Style the confirm button as a destructive action. Defaults to `false`. */
  destructive?: boolean
  /** Whether the confirmed action is in flight; disables buttons and spins. */
  pending?: boolean
  /** Invoked when the user confirms. */
  onConfirm: () => void
  /** `data-testid` for the confirm button. */
  confirmTestId?: string
  /** `data-testid` for the cancel button. */
  cancelTestId?: string
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  pending = false,
  onConfirm,
  confirmTestId,
  cancelTestId,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description != null && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pending} data-testid={cancelTestId}>
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={onConfirm}
            data-testid={confirmTestId}
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
