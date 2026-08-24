import { SecondFactorThrottled } from '@kurasikapa/application'
import { authGraph } from '@kurasikapa/web-kit/composition/auth-graph'
import { issuedCookies, withCookies } from '@kurasikapa/web-kit/composition/session-transport'
import { callerKey } from '@kurasikapa/web-kit/security/rate-limit'

/**
 * Exchanges a challenge plus a code for a real session.
 *
 * The challenge token proves the password was accepted; it is NOT a session and
 * never travels in a cookie. `CompleteSecondFactor` re-checks its kind, so a
 * caller cannot present an access token here and skip the factor.
 */

interface Body {
  readonly challengeToken?: unknown
  readonly code?: unknown
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

export async function POST(request: Request): Promise<Response> {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return Response.json({ message: 'Expected a JSON body.' }, { status: 400 })
  }

  try {
    const tokens = await authGraph().secondFactor.execute({
      challengeToken: str(body.challengeToken),
      code: str(body.code),
      callerKey: await callerKey(null),
    })

    return withCookies(Response.json({ signedIn: true }, { status: 200 }), issuedCookies(tokens))
  } catch (error) {
    if (error instanceof SecondFactorThrottled) {
      return Response.json({ message: error.message }, { status: 429 })
    }

    // One message for a wrong code, an expired challenge and a spent recovery
    // code. Which one it was is exactly what a brute-forcer wants told.
    return Response.json({ message: 'That code did not match.' }, { status: 401 })
  }
}
