import * as React from "react"

/**
 * The sample position a timeline drag resolves to for a given pointer position.
 * `rawSample` is the unmodified sample under the cursor; `sample` is what the
 * consumer should act on after any `snap` transform (they are identical when no
 * snapping is applied).
 */
export type TimelineDragSample = {
  /** Sample directly under the pointer, before snapping. */
  rawSample: number
  /** Sample after the optional `snap` transform; use this to drive state. */
  sample: number
}

export type UseTimelineDragOptions = {
  /**
   * Map an absolute pointer `clientX` (px) to a timeline sample. Typically the
   * timeline's `clientXToSample` from `useTimelineCoords`, so the gesture tracks
   * the current pan/zoom automatically.
   */
  clientXToSample: (clientX: number) => number
  /**
   * Optional transform applied to the raw sample before it is reported — the
   * extension point for snapping (grid lines, clip edges, the playhead, …). Pure
   * function; return the sample to commit. Defaults to identity.
   */
  snap?: (rawSample: number) => number
  /** Fired on pointer-down, once the drag is armed. */
  onDragStart?: (value: TimelineDragSample, event: React.PointerEvent) => void
  /** Fired on every pointer-move while dragging. */
  onDrag: (value: TimelineDragSample, event: React.PointerEvent) => void
  /** Fired when the drag ends (pointer-up) or is cancelled. */
  onDragEnd?: (value: TimelineDragSample, event: React.PointerEvent) => void
}

/**
 * Pointer-event handlers to spread onto the draggable element. Pointer capture
 * is taken on pointer-down so moves/ups keep flowing to the element even when
 * the cursor leaves it.
 */
export type TimelineDragHandlers = {
  onPointerDown: (event: React.PointerEvent) => void
  onPointerMove: (event: React.PointerEvent) => void
  onPointerUp: (event: React.PointerEvent) => void
  onPointerCancel: (event: React.PointerEvent) => void
}

export type UseTimelineDrag = {
  /** Spread onto the draggable element to wire up the standardized gesture. */
  dragHandlers: TimelineDragHandlers
  /** Whether a drag is currently in progress (for active styling). */
  dragging: boolean
}

/**
 * Standardized primitive for dragging something horizontally along the timeline.
 *
 * It owns the pointer plumbing every timeline drag needs — primary-button only,
 * pointer capture, stopping propagation so the enclosing `Timeline` doesn't also
 * pan, and converting `clientX` → sample on each move — and reports the resulting
 * sample (raw and snapped) through `onDragStart`/`onDrag`/`onDragEnd`. Callers
 * decide what the sample *means* (move a scrubber, a clip edge, a marker, …),
 * keeping the gesture itself consistent across the editor.
 *
 * Reusable building block (no app/domain state of its own): the coordinate
 * mapping and `snap` rule arrive as options, so it can sit in any tier.
 */
export function useTimelineDrag(
  options: UseTimelineDragOptions,
): UseTimelineDrag {
  const { clientXToSample, snap, onDragStart, onDrag, onDragEnd } = options
  const pointerIdRef = React.useRef<number | null>(null)
  const [dragging, setDragging] = React.useState(false)

  const resolve = (clientX: number): TimelineDragSample => {
    const rawSample = clientXToSample(clientX)
    return { rawSample, sample: snap ? snap(rawSample) : rawSample }
  }

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return
    // Don't let the timeline start a pan/zoom drag underneath this handle.
    event.stopPropagation()
    event.preventDefault()
    pointerIdRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
    onDragStart?.(resolve(event.clientX), event)
  }

  const onPointerMove = (event: React.PointerEvent) => {
    if (pointerIdRef.current !== event.pointerId) return
    onDrag(resolve(event.clientX), event)
  }

  const finish = (event: React.PointerEvent) => {
    if (pointerIdRef.current !== event.pointerId) return
    pointerIdRef.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    onDragEnd?.(resolve(event.clientX), event)
  }

  return {
    dragHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
    },
    dragging,
  }
}
