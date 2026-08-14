import { OAuthExchangeFailed } from '@kurasikapa/application'
import type { ExternalProvider } from '@kurasikapa/domain'

/**
 * The claim readers every OAuth adapter in this directory shares.
 *
 * They arrived by copy-and-paste, one adapter at a time, and the copies had
 * already begun to drift — Google's verified-email reader accepted the string
 * "true", Facebook's had no reader at all. A claim reader that behaves
 * differently per provider is precisely how an unverified address reaches the
 * domain as verified, so there is now exactly one of each.
 */

/** An absent, empty or non-string claim is no claim at all, and says so in the type. */
export function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

/**
 * Both spellings of an asserted flag, and nothing else.
 *
 * Google and Apple each document `email_verified` as a JSON boolean and each
 * ship it as the STRING "true" on some paths. `=== true` alone marks every
 * such address unverified, which blocks legitimate account matching; a truthy
 * test promotes the string "false" to verified, which is account takeover in
 * one step, because the use case links a provider identity onto an EXISTING
 * account by matching a verified email. Everything else — absent, `false`,
 * `"1"`, `null` — is not an assertion and must read as false.
 */
export function assertedTrue(value: unknown): boolean {
  return value === true || value === 'true'
}

/**
 * The one way an adapter in this directory reports failure.
 *
 * Returns `never`, so TypeScript narrows at every call site — that is what
 * lets the checks in the adapters read as guards rather than as if/else
 * pyramids. Reasons describe what failed, never what was sent: no code, no
 * verifier, no token and no secret may reach this string, because
 * `OAuthExchangeFailed.message` is logged and may be shown to the person
 * signing in.
 */
export function failOAuth(provider: ExternalProvider, reason: string): never {
  throw new OAuthExchangeFailed(provider, reason)
}

/**
 * jose's failure code, or `'unknown'`.
 *
 * The codes are a fixed enum, so they are safe to put in a message, and they
 * are the difference between "our clock is wrong" and "someone is forging
 * tokens".
 *
 * The SHAPE is checked before the property is read, and that guard is the
 * whole point of this function. A `catch` binding is `unknown`: it can be
 * `null`, a bare string, or anything else a thrown value may be, and
 * `(null as { code?: unknown }).code` throws a TypeError. That TypeError
 * escapes from inside the catch block — turning the one failure path these
 * adapters exist to report cleanly into an unhandled 500. Key and encoding
 * problems also surface as a plain TypeError carrying no code at all, which
 * is why the fallback is load-bearing rather than defensive.
 */
export function joseErrorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null) return 'unknown'

  const code: unknown = (error as { code?: unknown }).code

  return typeof code === 'string' ? code : 'unknown'
}

/**
 * A parsed JSON body, or null when it was not an object.
 *
 * `typeof null === 'object'`, so the null check is the reason this exists
 * rather than a bare `typeof`. Every provider here answers some failure with
 * `null`, `[]` or a bare string, and indexing that is a TypeError this port
 * has no vocabulary for.
 */
export function asJsonObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}
