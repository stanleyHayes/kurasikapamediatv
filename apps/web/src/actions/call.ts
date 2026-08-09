import type { ActionResult } from './result'

/**
 * Calls a Server Action from a Client Component without letting an unexpected
 * failure vanish.
 *
 * Server Actions here return `ActionResult` for the errors we anticipated, and
 * `toActionError` deliberately RETHROWS anything else so the error boundary
 * and the server log both see it. That is the right call on the server — but
 * on the client it means the returned promise rejects, and an unhandled
 * rejection inside `startTransition` sets no state at all.
 *
 * The symptom is a button that says "Translating…" for ever: no result, no
 * error, no way for the reader to know anything went wrong. Every client
 * caller had this hole before this existed.
 *
 * The message is deliberately generic. An unanticipated error is by definition
 * one we have not written a safe sentence for, and forwarding a raw server
 * message can leak a connection string or a provider's internals to whoever
 * clicked the button.
 */
export async function callAction<T>(
  run: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await run()
  } catch {
    return {
      ok: false,
      error: { code: 'unexpected', message: 'Something went wrong. Please try again.' },
    }
  }
}
