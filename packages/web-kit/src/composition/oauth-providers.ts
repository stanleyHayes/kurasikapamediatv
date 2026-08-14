import type { ClockPort, OAuthProvider, SecretGenerator } from '@kurasikapa/application'
import {
  AppleOAuthProvider,
  FacebookOAuthProvider,
  GoogleOAuthProvider,
} from '@kurasikapa/adapter-auth'
import { env } from './env'

/**
 * Builds the providers whose credentials are actually present.
 *
 * The rule that survived from the previous implementation: a provider is
 * configured only when EVERY value it needs is set. Half-configured is worse
 * than absent, because the button renders, the reader clicks it, and the
 * failure happens on a page we do not own and cannot explain.
 *
 * Each factory returns null rather than throwing, so a deployment with only
 * Google configured boots and shows one button.
 */
const present = (value: string | undefined): value is string =>
  value !== undefined && value.trim() !== ''

export function googleProvider(secrets: SecretGenerator): OAuthProvider | null {
  const clientId = process.env['GOOGLE_CLIENT_ID']
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET']

  if (!present(clientId) || !present(clientSecret)) return null

  return new GoogleOAuthProvider({ clientId, clientSecret }, secrets)
}

export function facebookProvider(secrets: SecretGenerator): OAuthProvider | null {
  const clientId = process.env['FACEBOOK_CLIENT_ID']
  const clientSecret = process.env['FACEBOOK_CLIENT_SECRET']

  if (!present(clientId) || !present(clientSecret)) return null

  return new FacebookOAuthProvider({ clientId, clientSecret }, secrets)
}

/**
 * Restores the real newlines in a PKCS#8 PEM.
 *
 * Vercel's dashboard cannot hold a literal newline, so the .p8 key is stored
 * with `\n` escaped. A PEM without real newlines fails to import with an error
 * that says nothing about why, and it fails at the first sign-in rather than
 * at boot.
 *
 * Exported for its own test: the restored key is held privately by the
 * adapter, so this is the only place its shape can be asserted.
 */
export function pkcs8FromEnv(stored: string): string {
  return stored.replace(/\\n/gu, '\n')
}

/**
 * Apple needs four values, not two.
 *
 * Its client secret is not a string Apple hands over — it is an ES256 JWT we
 * sign with a downloaded .p8 key. So "is Apple configured?" is a question
 * about four environment variables, and checking only for a CLIENT_SECRET
 * (as a two-value provider would) would report it configured when it cannot
 * possibly work.
 *
 * It is also the only provider needing a clock: that JWT is cached until
 * shortly before its own `exp`, and the adapter takes the clock as a port so
 * the cache boundary is testable. The wall clock is read here, where it is
 * allowed, and nowhere below.
 */
export function appleProvider(secrets: SecretGenerator, clock: ClockPort): OAuthProvider | null {
  const { APPLE_SERVICES_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY } = env()

  if (
    !present(APPLE_SERVICES_ID) ||
    !present(APPLE_TEAM_ID) ||
    !present(APPLE_KEY_ID) ||
    !present(APPLE_PRIVATE_KEY)
  ) {
    return null
  }

  return new AppleOAuthProvider(
    {
      servicesId: APPLE_SERVICES_ID,
      teamId: APPLE_TEAM_ID,
      keyId: APPLE_KEY_ID,
      privateKeyPkcs8: pkcs8FromEnv(APPLE_PRIVATE_KEY),
    },
    secrets,
    clock,
  )
}
