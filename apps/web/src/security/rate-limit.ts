import type { RateLimitRule, RateLimiter } from '@kurasikapa/application'
import { headers } from 'next/headers'

/**
 * Rate limit policy: what is limited, how hard, and what happens when the
 * limiter itself is unavailable.
 *
 * The rules are here rather than at each call site so they can be read
 * together. A limit nobody can see next to its neighbours is a limit that gets
 * set by whoever last touched the file.
 */
export const RULES = {
  /**
   * AI assists. These cost money per call, so the limit protects a budget
   * rather than a server.
   */
  ai: { limit: 20, windowSeconds: 60 },

  /**
   * Sign-in attempts. Tight, because the attack is credential stuffing and a
   * legitimate person does not need six tries a minute.
   */
  signIn: { limit: 6, windowSeconds: 60 },

  /** Search. Protects the database, which is why it is looser. */
  search: { limit: 60, windowSeconds: 60 },

  /**
   * Reader comments. Tight and fail-closed: an uncounted comment endpoint
   * is a spam cannon, and a pending queue nobody can moderate.
   */
  comments: { limit: 8, windowSeconds: 60 },

  /** Likes. Fail-closed so an outage cannot inflate a public count. */
  likes: { limit: 30, windowSeconds: 60 },

  /**
   * Newsletter subscribe/confirm/unsubscribe. Fail-closed: an uncounted
   * signup endpoint is a spam cannon against the mailer.
   */
  newsletter: { limit: 8, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>

/**
 * Whether a failure of the limiter itself should allow or refuse the request.
 *
 * This is the decision people get wrong, so it is named rather than implied.
 *
 * `closed` for AI and comments: if Mongo is unreachable we cannot count.
 * An uncounted AI endpoint is an unbounded bill; an uncounted comment
 * endpoint is a spam queue. Refusing is recoverable.
 *
 * `open` for sign-in and search: refusing every sign-in because the counter
 * is down turns a database blip into a total outage, and the thing being
 * protected — brute force — is slow enough that a short unguarded window is a
 * far smaller risk than locking the newsroom out of its own site.
 */
export type OnFailure = 'open' | 'closed'

export interface Limited {
  readonly allowed: boolean
  readonly retryAfterSeconds: number
}

const ALLOWED: Limited = { allowed: true, retryAfterSeconds: 0 }

/**
 * Identifies the caller for limiting purposes.
 *
 * Actor id when signed in — it survives a changing IP, and limiting a known
 * account is fairer than limiting whatever network it is on. Otherwise the
 * forwarded IP, which is spoofable in general but not behind Vercel's proxy,
 * which overwrites it.
 *
 * Falls back to a single shared bucket rather than to "no limit". An
 * unidentifiable caller sharing one budget is a blunt instrument; an
 * unidentifiable caller with no limit is the hole every attacker looks for.
 */
export async function callerKey(actorId: string | null): Promise<string> {
  if (actorId !== null) return `actor:${actorId}`

  const forwarded = (await headers()).get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim()

  return ip === undefined || ip === '' ? 'anon:unidentified' : `ip:${ip}`
}

/**
 * Counts one attempt and says whether it may proceed.
 *
 * Never throws. A limiter that throws turns every guarded call site into a
 * try/catch, and the one that forgets it is the one that breaks in production.
 */
export async function limit(
  limiter: RateLimiter,
  key: string,
  scope: keyof typeof RULES,
  onFailure: OnFailure,
): Promise<Limited> {
  try {
    const verdict = await limiter.consume(`${scope}:${key}`, RULES[scope])

    return verdict.allowed
      ? ALLOWED
      : { allowed: false, retryAfterSeconds: verdict.retryAfterSeconds }
  } catch (error) {
    // Reported, not swallowed. A limiter that has been failing open for a
    // month is a limit that does not exist, and nobody finds that out from a
    // silent catch.
    console.error(
      JSON.stringify({
        event: 'rate_limit.unavailable',
        scope,
        onFailure,
        reason: error instanceof Error ? error.message : String(error),
      }),
    )

    return onFailure === 'open'
      ? ALLOWED
      : { allowed: false, retryAfterSeconds: RULES[scope].windowSeconds }
  }
}

/**
 * Thrown when a caller has spent their allowance.
 *
 * Carries the wait so the UI can say "try again in 40 seconds" rather than
 * "something went wrong" — a limit a person cannot see the shape of is
 * indistinguishable from a broken feature, and they will retry immediately.
 */
export class RateLimited extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(`Too many requests. Try again in ${String(retryAfterSeconds)} seconds.`)
    this.name = 'RateLimited'
  }
}
