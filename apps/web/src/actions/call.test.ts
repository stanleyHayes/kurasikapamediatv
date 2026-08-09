import { describe, expect, it } from 'vitest'
import { callAction } from './call'

describe('callAction', () => {
  it('passes a successful result straight through', async () => {
    const result = await callAction(() => Promise.resolve({ ok: true, data: 42 } as const))

    expect(result).toEqual({ ok: true, data: 42 })
  })

  it('passes an anticipated error through unchanged', async () => {
    // Errors the action already mapped carry a safe, specific message. They
    // must not be flattened into the generic one.
    const known = { ok: false, error: { code: 'not_signed_in', message: 'Sign in first.' } } as const

    expect(await callAction(() => Promise.resolve(known))).toEqual(known)
  })

  it('turns a rejection into a result instead of letting it vanish', async () => {
    // The bug this exists for. toActionError rethrows unexpected errors so the
    // server log sees them; on the client that rejection inside a transition
    // sets no state, and the button says "Translating…" for ever.
    const result = await callAction(() => Promise.reject(new Error('boom')))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('unexpected')
  })

  it('does not forward the server message to the reader', async () => {
    // An unanticipated error is by definition one we have no safe sentence
    // for. Forwarding it can leak a connection string or a provider's
    // internals to whoever clicked the button.
    const result = await callAction(() =>
      Promise.reject(new Error('mongodb://user:hunter2@cluster.internal/kurasikapa')),
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).not.toContain('hunter2')
      expect(result.error.message).not.toContain('mongodb')
    }
  })
})
