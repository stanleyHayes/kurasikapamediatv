import { timingSafeEqual } from 'node:crypto'

/**
 * Authorises a scheduled-invocation request against a shared secret.
 *
 * Lives here rather than inside the route so it can be tested without booting
 * a container that needs MongoDB. The guard on an endpoint that publishes
 * articles is exactly the code that must not be untested because it was
 * awkward to reach.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 */
export function isAuthorisedCron(request: Request, configured: string | undefined): boolean {
  // Unset means refuse, never means allow. An endpoint that publishes articles
  // must not fall open because someone forgot an environment variable.
  if (configured === undefined || configured === '') return false

  const header = request.headers.get('authorization')
  if (header?.startsWith('Bearer ') !== true) return false

  const presented = Buffer.from(header.slice('Bearer '.length))
  const expected = Buffer.from(configured)

  // timingSafeEqual throws on a length mismatch, and that throw is itself a
  // length oracle. Compare the expected value with itself so a wrong-length
  // guess costs the same as a right-length one, then answer false.
  if (presented.length !== expected.length) {
    timingSafeEqual(expected, expected)

    return false
  }

  return timingSafeEqual(presented, expected)
}
