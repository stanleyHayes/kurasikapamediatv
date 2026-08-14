import type { SessionTokens } from '@kurasikapa/application'
import { describe, expect, it } from 'vitest'
import {
  accessCookieName,
  clearedSessionCookies,
  refreshCookieName,
  sessionCookies,
  type CookieSpec,
  type SessionCookieOptions,
} from './session-cookies'

const tokens: SessionTokens = {
  accessToken: 'access.jwt',
  refreshToken: 'refresh-opaque',
  sessionId: 'session-1',
  accessExpiresInSeconds: 900,
  refreshExpiresInSeconds: 2_592_000,
}

const production: SessionCookieOptions = {
  secure: true,
  domain: '.kurasikapa.tv',
  refreshPath: '/api/auth/refresh',
}

const local: SessionCookieOptions = {
  secure: false,
  domain: undefined,
  refreshPath: '/api/auth/refresh',
}

const named = (specs: readonly CookieSpec[], name: string): CookieSpec => {
  const found = specs.find((spec) => spec.name === name)
  if (found === undefined) throw new Error(`no cookie named ${name}`)

  return found
}

describe('cookie names', () => {
  it('takes the __Secure- prefix only over https', () => {
    // The browser REFUSES a `__Secure-*` cookie that is not Secure, so a
    // prefixed name over plain http is not a weaker cookie — it is no cookie
    // at all, and local sign-in silently stops working.
    expect(accessCookieName(true)).toBe('__Secure-kurasikapa_session')
    expect(refreshCookieName(true)).toBe('__Secure-kurasikapa_refresh')
  })

  it('drops the prefix over http, so local development still holds a session', () => {
    expect(accessCookieName(false)).toBe('kurasikapa_session')
    expect(refreshCookieName(false)).toBe('kurasikapa_refresh')
  })

  it('gives the two cookies different names', () => {
    // One name for both would have the refresh token overwrite the access
    // token, and every request after sign-in would arrive with a credential
    // the access path cannot verify.
    expect(accessCookieName(true)).not.toBe(refreshCookieName(true))
  })
})

describe('sessionCookies', () => {
  it('scopes the refresh cookie to the refresh route and nothing else', () => {
    // The whole point of two cookies. A refresh token on `/` accompanies every
    // page view — including every image and every RSS fetch — and it is the
    // credential worth thirty days rather than fifteen minutes.
    const specs = sessionCookies(tokens, production)

    expect(named(specs, '__Secure-kurasikapa_session').path).toBe('/')
    expect(named(specs, '__Secure-kurasikapa_refresh').path).toBe('/api/auth/refresh')
  })

  it('carries each token with its own lifetime', () => {
    const specs = sessionCookies(tokens, production)

    expect(named(specs, '__Secure-kurasikapa_session')).toMatchObject({
      value: 'access.jwt',
      maxAge: 900,
    })
    expect(named(specs, '__Secure-kurasikapa_refresh')).toMatchObject({
      value: 'refresh-opaque',
      maxAge: 2_592_000,
    })
  })

  it('marks both cookies httpOnly and lax', () => {
    // httpOnly keeps an XSS from reading the session; lax rather than strict
    // because a reader arriving from a search result or a newsletter link must
    // not land signed out on a site whose traffic is overwhelmingly inbound.
    for (const spec of sessionCookies(tokens, production)) {
      expect(spec.httpOnly).toBe(true)
      expect(spec.sameSite).toBe('lax')
    }
  })

  it('widens both cookies to the parent domain when one is configured', () => {
    // Split-origin deployment: the site issues the session and the studio
    // reads it. Host-scoped, the studio subdomain never sees it and an editor
    // signs in successfully into a redirect loop.
    for (const spec of sessionCookies(tokens, production)) {
      expect(spec.domain).toBe('.kurasikapa.tv')
    }
  })

  it('omits the domain attribute entirely when none is configured', () => {
    // Not `domain: undefined` — a cookie writer that sees the key may emit
    // `Domain=undefined`, which no browser accepts. Same-origin is the default
    // shape, so this is the common path.
    for (const spec of sessionCookies(tokens, local)) {
      expect(spec).not.toHaveProperty('domain')
    }
  })

  it('follows the secure flag into both the flag and the name', () => {
    const specs = sessionCookies(tokens, local)

    expect(specs.map((spec) => spec.name)).toStrictEqual([
      'kurasikapa_session',
      'kurasikapa_refresh',
    ])
    expect(specs.every((spec) => !spec.secure)).toBe(true)
  })
})

describe('clearedSessionCookies', () => {
  it('matches the set cookies on name, path and domain exactly', () => {
    // A mismatch on any of the three writes a SECOND cookie beside the first
    // instead of replacing it. The browser then keeps sending the original and
    // the reader stays signed in after signing out — silently, because the
    // sign-out response looks entirely successful.
    const cleared = clearedSessionCookies(production)
    const set = sessionCookies(tokens, production)

    expect(cleared.map((spec) => [spec.name, spec.path, spec.domain])).toStrictEqual(
      set.map((spec) => [spec.name, spec.path, spec.domain]),
    )
  })

  it('expires both cookies immediately and empties their values', () => {
    for (const spec of clearedSessionCookies(production)) {
      expect(spec.value).toBe('')
      expect(spec.maxAge).toBe(0)
    }
  })

  it('stays host-only when the session was host-only', () => {
    for (const spec of clearedSessionCookies(local)) {
      expect(spec).not.toHaveProperty('domain')
    }
  })
})
