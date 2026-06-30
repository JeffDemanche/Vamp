/**
 * Microphone access helpers shared by the recording UI: a passive permission
 * probe (used to preflight on project load without prompting) and a translator
 * from `getUserMedia` failures into messages worth showing a user.
 */

/**
 * The microphone permission as understood by the editor:
 *
 * - `granted` — access already allowed; recording can start without a prompt.
 * - `denied` — explicitly blocked; the browser won't re-prompt until the user
 *   changes the site's settings.
 * - `prompt` — not decided yet; the next capture attempt will ask.
 * - `unsupported` — the Permissions API can't report on the microphone here, so
 *   the state is unknown until we actually try to capture.
 */
export type MicrophonePermission = "granted" | "denied" | "prompt" | "unsupported";

/**
 * Read the current microphone permission **without** prompting, via the
 * Permissions API. Returns `"unsupported"` when the API (or the `microphone`
 * descriptor) isn't available, e.g. some Firefox/Safari versions — callers then
 * fall back to attempting capture to learn the real state.
 */
export async function queryMicrophonePermission(): Promise<MicrophonePermission> {
  const permissions = navigator.permissions;
  if (!permissions?.query) return "unsupported";
  try {
    const status = await permissions.query({
      name: "microphone" as PermissionName,
    });
    return status.state as MicrophonePermission;
  } catch {
    return "unsupported";
  }
}

/**
 * Subscribe to microphone permission changes (Permissions API `onchange`).
 * Calls `onChange` with the new state until the returned unsubscribe runs.
 * No-op (returns a noop unsubscribe) where the API is unavailable.
 */
export function subscribeMicrophonePermission(
  onChange: (state: MicrophonePermission) => void,
): () => void {
  const permissions = navigator.permissions;
  if (!permissions?.query) return () => {};

  let status: PermissionStatus | null = null;
  const handle = () => {
    if (status) onChange(status.state as MicrophonePermission);
  };
  let cancelled = false;

  void permissions
    .query({ name: "microphone" as PermissionName })
    .then((s) => {
      if (cancelled) return;
      status = s;
      s.addEventListener("change", handle);
    })
    .catch(() => {
      // Permissions API can't watch the microphone here; nothing to subscribe to.
    });

  return () => {
    cancelled = true;
    status?.removeEventListener("change", handle);
  };
}

/**
 * Whether an error from `getUserMedia` means access was explicitly denied (so
 * the browser won't prompt again without a settings change), as opposed to a
 * transient/hardware failure.
 */
export function isMicrophonePermissionDenied(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "SecurityError")
  );
}

/**
 * Turn a microphone-acquisition failure into a concise, user-facing message
 * explaining what went wrong and (where relevant) how to recover.
 */
export function describeMicrophoneError(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "SecurityError":
        return "Microphone access is blocked. Allow it in your browser's site settings, then try again.";
      case "NotFoundError":
      case "OverconstrainedError":
        return "No microphone was found. Connect one and try again.";
      case "NotReadableError":
        return "Your microphone is in use by another app. Close it and try again.";
      default:
        return error.message || "Could not access the microphone.";
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return "Could not access the microphone.";
}
