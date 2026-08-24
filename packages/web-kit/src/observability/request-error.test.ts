import { describe, expect, it, vi } from 'vitest'
import { reportRequestError } from './request-error'

const request = {
  path: '/en/articles/breaking',
  method: 'GET',
  headers: {
    cookie: 'kura.session=super-secret-token',
    authorization: 'Bearer super-secret-token',
    'user-agent': 'Mozilla/5.0',
  },
}

const context = {
  routerKind: 'App Router',
  routePath: '/[locale]/articles/[slug]',
  routeType: 'render',
  revalidateReason: undefined,
} as const

const emit = (
  error: unknown,
  overrides: Partial<typeof request> = {},
): Record<string, unknown> => {
  const sink = vi.fn()
  reportRequestError(error, { ...request, ...overrides }, context, sink)
  expect(sink).toHaveBeenCalledOnce()
  return JSON.parse(sink.mock.calls[0]?.[0] as string) as Record<string, unknown>
}

describe('reportRequestError', () => {
  it('emits one structured line an alert can key on', () => {
    // Matches the shape the cron routes already log. A log-based alert needs a
    // stable `event`, not prose that changes with the next edit.
    const line = emit(new TypeError('render blew up'))
    expect(line['event']).toBe('request.error')
    expect(line['error']).toBe('TypeError: render blew up')
  })

  it('carries the routing context, so the line names the page that broke', () => {
    const line = emit(new Error('boom'))
    expect(line).toMatchObject({
      path: '/en/articles/breaking',
      method: 'GET',
      routePath: '/[locale]/articles/[slug]',
      routeType: 'render',
      routerKind: 'App Router',
    })
  })

  it('NEVER logs request headers', () => {
    // `headers` carries the session cookie and the Authorization header. An
    // error report that includes them turns a crash into a credential leak in
    // whatever aggregates the logs — and log retention outlives the session.
    const line = emit(new Error('boom'))
    const serialised = JSON.stringify(line)
    expect(serialised).not.toMatch(/super-secret-token/u)
    expect(serialised).not.toMatch(/cookie/iu)
    expect(line['headers']).toBeUndefined()
  })

  it('keeps the stack, which is the only part that locates the fault', () => {
    const error = new Error('boom')
    const line = emit(error)
    expect(line['stack']).toContain('Error: boom')
  })

  it('reports a thrown non-error rather than dropping it', () => {
    // A `throw 'string'` is rarer than a thrown Error and far more confusing to
    // debug; it must not be the case that goes missing.
    const line = emit('just a string')
    expect(line['error']).toBe('just a string')
    expect(line['stack']).toBeUndefined()
  })

  it('strips a query string, which is where reset tokens travel', () => {
    const line = emit(new Error('boom'), { path: '/en/reset?token=super-secret-token' })
    expect(line['path']).toBe('/en/reset')
    expect(JSON.stringify(line)).not.toMatch(/super-secret-token/u)
  })
})
