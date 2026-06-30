import * as React from "react"

/**
 * A lightweight, contextual keyboard-shortcut system for the project editor.
 *
 * One `HotkeyProvider` owns a single `keydown` listener on the window and a
 * registry of active bindings. Feature components register their shortcuts with
 * the `useHotkey` hook for as long as they are mounted, so shortcuts are
 * *contextual*: they exist only while the surface that owns them is on screen,
 * and each can gate itself with an `enabled` flag (e.g. "delete" only fires when
 * clips are selected).
 *
 * When several bindings match the same keystroke, the **most recently
 * registered** one wins — a nested/active context naturally overrides shortcuts
 * declared higher up. Bindings do not fire while the user is typing in an
 * editable element (input/textarea/contenteditable) unless they opt in with
 * `allowInEditable`, so text entry (like the project title field) is never
 * hijacked.
 */

type ParsedCombo = {
  /** Lower-cased `KeyboardEvent.key` to match (e.g. "delete", "a", " "). */
  key: string
  /** Require either ⌘ (meta) or Ctrl — the platform-agnostic "command" key. */
  mod: boolean
  meta: boolean
  ctrl: boolean
  alt: boolean
  shift: boolean
}

/** A single registered shortcut. `isEnabled`/`run` read live values via refs. */
type Binding = {
  combos: ParsedCombo[]
  isEnabled: () => boolean
  run: (event: KeyboardEvent) => void
  allowInEditable: boolean
}

type HotkeyRegistry = {
  /** Register a binding, returning a function that removes it. */
  register: (binding: Binding) => () => void
}

const HotkeyContext = React.createContext<HotkeyRegistry | null>(null)

/** Options accepted by {@link useHotkey}. */
export type UseHotkeyOptions = {
  /**
   * Whether the shortcut is currently active. Defaults to `true`. Read live on
   * each keystroke, so toggling it never re-registers the binding.
   */
  enabled?: boolean
  /**
   * Allow the shortcut to fire even when an editable element (input, textarea,
   * contenteditable) has focus. Defaults to `false` so typing is never
   * hijacked.
   */
  allowInEditable?: boolean
}

/**
 * Register a keyboard shortcut for as long as the calling component is mounted.
 * `combo` is a single combo string or an array of them; each is `+`-separated,
 * e.g. `"Delete"`, `"Backspace"`, `"Mod+z"` (⌘ on macOS / Ctrl elsewhere),
 * `"Shift+?"`. Must be called within a {@link HotkeyProvider}.
 */
export function useHotkey(
  combo: string | string[],
  handler: (event: KeyboardEvent) => void,
  options: UseHotkeyOptions = {},
): void {
  const registry = React.useContext(HotkeyContext)
  if (!registry) {
    throw new Error("useHotkey must be used within a <HotkeyProvider>")
  }

  const handlerRef = React.useRef(handler)
  handlerRef.current = handler
  const enabled = options.enabled ?? true
  const enabledRef = React.useRef(enabled)
  enabledRef.current = enabled
  const allowInEditable = options.allowInEditable ?? false

  // Re-register only when the combo or editable behaviour changes; the handler
  // and enabled flag are read live through refs so they stay current without
  // churning the registry.
  const comboKey = Array.isArray(combo) ? combo.join("|") : combo
  React.useEffect(() => {
    return registry.register({
      combos: parseCombos(combo),
      isEnabled: () => enabledRef.current,
      run: (event) => handlerRef.current(event),
      allowInEditable,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, comboKey, allowInEditable])
}

/**
 * Provides the hotkey registry and owns the single window `keydown` listener.
 * Wrap the surface whose shortcuts you want to scope (e.g. the project editor).
 */
export function HotkeyProvider({ children }: { children: React.ReactNode }) {
  // Bindings live in a ref (not state) so registering/unregistering never
  // re-renders consumers; the keydown listener reads the latest list directly.
  const bindingsRef = React.useRef<Binding[]>([])

  const registry = React.useMemo<HotkeyRegistry>(
    () => ({
      register(binding) {
        bindingsRef.current.push(binding)
        return () => {
          bindingsRef.current = bindingsRef.current.filter((b) => b !== binding)
        }
      },
    }),
    [],
  )

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const editable = isEditableTarget(event.target)
      // Newest binding wins, so the innermost/most-recent context overrides.
      for (let i = bindingsRef.current.length - 1; i >= 0; i--) {
        const binding = bindingsRef.current[i]!
        if (!binding.isEnabled()) continue
        if (editable && !binding.allowInEditable) continue
        if (binding.combos.some((combo) => matchesCombo(combo, event))) {
          event.preventDefault()
          binding.run(event)
          return
        }
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return <HotkeyContext.Provider value={registry}>{children}</HotkeyContext.Provider>
}

function parseCombos(combo: string | string[]): ParsedCombo[] {
  return (Array.isArray(combo) ? combo : [combo]).map(parseCombo)
}

function parseCombo(combo: string): ParsedCombo {
  const parts = combo
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)

  const parsed: ParsedCombo = {
    key: "",
    mod: false,
    meta: false,
    ctrl: false,
    alt: false,
    shift: false,
  }

  for (const part of parts) {
    switch (part.toLowerCase()) {
      case "mod":
        parsed.mod = true
        break
      case "meta":
      case "cmd":
      case "command":
        parsed.meta = true
        break
      case "ctrl":
      case "control":
        parsed.ctrl = true
        break
      case "alt":
      case "option":
        parsed.alt = true
        break
      case "shift":
        parsed.shift = true
        break
      default:
        // The last non-modifier token is the key itself. "space" is spelled out
        // since the underlying KeyboardEvent.key for it is a literal space.
        parsed.key = part.toLowerCase() === "space" ? " " : part.toLowerCase()
    }
  }

  return parsed
}

function matchesCombo(combo: ParsedCombo, event: KeyboardEvent): boolean {
  if (event.key.toLowerCase() !== combo.key) return false
  if (event.altKey !== combo.alt) return false
  if (event.shiftKey !== combo.shift) return false
  if (combo.mod) {
    // "Mod" matches either platform's command key; the specific one is ignored.
    return event.metaKey || event.ctrlKey
  }
  return event.metaKey === combo.meta && event.ctrlKey === combo.ctrl
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  return target.isContentEditable
}
