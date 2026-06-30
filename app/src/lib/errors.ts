/**
 * Keeps technical errors out of the user-facing UI.
 *
 * The client should never render raw error details (GraphQL/network messages,
 * stack traces, server internals) to users. Instead, log the real error to the
 * console for debugging via {@link logError} and show a friendly, generic
 * message in the interface.
 */
export function logError(context: string, error: unknown): void {
  console.error(`[Vamp] ${context}`, error);
}
