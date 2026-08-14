import { asJsonObject, failOAuth, nonEmptyString } from './claims'
import { requestWithTimeout, type FetchLike, type HttpRequest } from './http'

/**
 * Meta's Graph API, reduced to the calls Facebook sign-in makes.
 *
 * It is its own object for the same reasons `AppleClientSecret` is: it takes
 * facebook.ts under the 250-line cap, and the behaviour worth testing here —
 * a stalled endpoint, a body that is not JSON, Graph's own error message —
 * can only be driven independently if it is constructible with a fake
 * transport and no sign-in flow wrapped around it.
 */

/**
 * Pinned on purpose. An unversioned Graph URL floats to whatever Meta ships
 * next, so a breaking change would land on us with no deploy of ours and on
 * Meta's calendar. Versions expire roughly two years after release — v26.0
 * shipped 29 July 2026 — which makes this a dated commitment somebody has to
 * renew, not a set-and-forget.
 */
const GRAPH_VERSION = 'v26.0'

export const DIALOG_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`
export const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`

const FORM_HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded' }

/** A parsed Graph body. Every field is `unknown`: this is JSON from outside. */
export type GraphBody = Record<string, unknown>

export class GraphClient {
  constructor(
    private readonly http: FetchLike,
    private readonly timeoutMs: number,
  ) {}

  post(url: string, body: URLSearchParams, stage: string): Promise<GraphBody> {
    return this.call({ url, method: 'POST', headers: FORM_HEADERS, body }, stage)
  }

  get(url: string, headers: Record<string, string>, stage: string): Promise<GraphBody> {
    return this.call({ url, method: 'GET', headers }, stage)
  }

  /**
   * Every Graph call, through one place: attach the deadline, parse once, name
   * the stage.
   *
   * `stage` exists because all of these calls fail identically from the
   * caller's side, and knowing WHICH one failed is the difference between a
   * misconfigured app and a spent code. Graph's own `error.message` is carried
   * through as the only clue an operator gets; it never contains the token,
   * and nothing here echoes the code, the token or the app secret.
   */
  private async call(request: Omit<HttpRequest, 'timeoutMs'>, stage: string): Promise<GraphBody> {
    // Narrow try: it wraps ONLY the network call, so a DNS failure or an
    // expired deadline is never reported as Graph rejecting our credentials.
    // Unwrapped, an aborted fetch rejects with a TimeoutError that reaches the
    // route as a 500 rather than as a sign-in failure it can explain.
    let response: Response
    try {
      response = await requestWithTimeout(this.http, { ...request, timeoutMs: this.timeoutMs })
    } catch {
      failOAuth('facebook', `${stage} could not be reached`)
    }

    const parsed: unknown = await response.json().catch(() => null)
    const body = asJsonObject(parsed)

    if (body === null) failOAuth('facebook', `${stage} returned a body that was not JSON`)
    if (!response.ok) failOAuth('facebook', `${stage} failed: ${graphMessage(body, response)}`)

    return body
  }
}

function graphMessage(body: GraphBody, response: Response): string {
  const error = asJsonObject(body['error'])
  const message = error === null ? null : nonEmptyString(error['message'])

  return message ?? `HTTP ${String(response.status)}`
}
