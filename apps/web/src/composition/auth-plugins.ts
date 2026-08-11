import { captcha, twoFactor } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'

type Source = Readonly<Record<string, string | undefined>>

/**
 * Better Auth plugins, in the order the library requires.
 *
 * `nextCookies` must be last so it can set the session cookie after every
 * other plugin has run. Captcha is omitted unless a Turnstile secret is
 * present — otherwise every sign-in would 400 on a missing token, including
 * local development and the Playwright journeys.
 */
type AuthPlugin =
  | ReturnType<typeof twoFactor>
  | ReturnType<typeof captcha>
  | ReturnType<typeof nextCookies>

export function authPlugins(source: Source): AuthPlugin[] {
  const secret = source['TURNSTILE_SECRET_KEY']
  const gated =
    secret !== undefined && secret !== ''
      ? [captcha({ provider: 'cloudflare-turnstile', secretKey: secret })]
      : []

  return [twoFactor({ issuer: 'Kurasikapa Media' }), ...gated, nextCookies()]
}

export function hasTurnstile(source: Source): boolean {
  const secret = source['TURNSTILE_SECRET_KEY']
  const site = source['NEXT_PUBLIC_TURNSTILE_SITE_KEY']

  return secret !== undefined && secret !== '' && site !== undefined && site !== ''
}
