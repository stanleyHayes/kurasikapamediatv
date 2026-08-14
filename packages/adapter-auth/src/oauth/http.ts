/**
 * The HTTP seam every OAuth adapter reaches the network through.
 *
 * Two reasons it exists rather than each adapter calling `fetch` directly:
 *
 * 1. Testability. `vi.mock` is banned (AGENTS.md § 4), so the only way to
 *    exercise a token exchange without the internet is to pass the transport
 *    in. Each adapter takes a `FetchLike` and defaults it to the global
 *    `fetch`, so production wiring is untouched and a test hands over a fake.
 *
 * 2. A deadline. None of these calls had one. undici's defaults are measured
 *    in the hundreds of seconds, so a provider endpoint that accepts the
 *    connection and then stalls pins a serverless sign-in invocation for five
 *    minutes — billed, holding a concurrency slot, and long past the point the
 *    reader gave up and clicked the button again.
 */

/** Structurally what `fetch` is, narrowed to the one call shape used here. */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

/**
 * Five seconds: long enough for a cold TLS handshake to a provider on another
 * continent, short enough that a stalled endpoint fails inside the request the
 * reader is waiting on rather than outliving it. Every adapter config can
 * override it, because these three endpoints do not have the same latency and
 * a single hard-coded number would eventually be wrong for one of them.
 */
export const DEFAULT_HTTP_TIMEOUT_MS = 5000

export interface HttpRequest {
  readonly url: string
  readonly method: 'GET' | 'POST'
  readonly headers: Record<string, string>
  readonly timeoutMs: number
  /** POST only. A GET carries its parameters in the URL. */
  readonly body?: URLSearchParams
}

/**
 * One request, with the deadline attached.
 *
 * The signal is built per call on purpose: `AbortSignal.timeout` starts
 * counting the moment it is constructed, so a module-level or per-instance
 * signal would already be expired by the second sign-in of the process and
 * every later exchange would abort instantly.
 *
 * Rejections are deliberately NOT translated here — this seam has no provider
 * to name. The caller wraps them in `OAuthExchangeFailed`, and it must: an
 * aborted fetch rejects with a `TimeoutError` that would otherwise leave the
 * route with an unhandled 500 instead of a sign-in failure it can explain.
 */
export function requestWithTimeout(http: FetchLike, request: HttpRequest): Promise<Response> {
  const { body } = request

  return http(request.url, {
    method: request.method,
    headers: request.headers,
    signal: AbortSignal.timeout(request.timeoutMs),
    // Spread rather than `body: request.body`, because `exactOptionalPropertyTypes`
    // makes an explicit `undefined` a type error on an optional field.
    ...(body === undefined ? {} : { body }),
  })
}

/** `undefined` means "not configured", never "no deadline". */
export function timeoutFrom(configured: number | undefined): number {
  return configured ?? DEFAULT_HTTP_TIMEOUT_MS
}
