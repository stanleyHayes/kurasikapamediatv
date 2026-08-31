import { completePasswordSecondFactor } from '@kurasikapa/web-kit/bff/password-session-http'

/**
 * Exchanges a challenge plus a code for a real session.
 *
 * The challenge token proves the password was accepted; it is NOT a session and
 * never travels in a cookie. `CompleteSecondFactor` re-checks its kind, so a
 * caller cannot present an access token here and skip the factor.
 */

export async function POST(request: Request): Promise<Response> {
  return completePasswordSecondFactor(request)
}
