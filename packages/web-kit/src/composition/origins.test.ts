import { describe, expect, it } from 'vitest'
import { cookieScope, signInUrl, siteUrl, studioUrl, trustedOrigins } from './origins'

const sameOrigin = {
  APP_URL: 'https://kurasikapa.tv',
  SITE_URL: undefined,
  STUDIO_URL: undefined,
} as const

describe('origins', () => {
  describe('same-origin deployment (the default)', () => {
    it('reads the site origin off APP_URL', () => {
      expect(siteUrl(sameOrigin)).toBe('https://kurasikapa.tv')
    })

    it('mounts the studio on the base path the studio build actually uses', () => {
      // If this ever disagrees with basePath in apps/studio/next.config.ts,
      // every cross-app link 404s. ADR-0011 records that they move together.
      expect(studioUrl(sameOrigin)).toBe('https://kurasikapa.tv/studio')
    })
  })

  describe('split-origin deployment', () => {
    const split = {
      APP_URL: 'https://studio.kurasikapa.tv',
      SITE_URL: 'https://kurasikapa.tv',
      STUDIO_URL: 'https://studio.kurasikapa.tv/studio',
    } as const

    it('prefers the explicit origins over APP_URL', () => {
      expect(siteUrl(split)).toBe('https://kurasikapa.tv')
      expect(studioUrl(split)).toBe('https://studio.kurasikapa.tv/studio')
    })
  })

  it('tolerates a trailing slash, which is how these get pasted into a dashboard', () => {
    const trailing = {
      APP_URL: 'https://kurasikapa.tv/',
      SITE_URL: undefined,
      STUDIO_URL: undefined,
    } as const

    // Without the trim this yields `https://kurasikapa.tv//studio`, which some
    // proxies serve and others 404 — the worst kind of environment-dependent bug.
    expect(studioUrl(trailing)).toBe('https://kurasikapa.tv/studio')
    expect(siteUrl(trailing)).toBe('https://kurasikapa.tv')
  })

  describe('signInUrl', () => {
    it('sends an editor to the site, in their own locale', () => {
      expect(signInUrl(sameOrigin, 'fr')).toBe('https://kurasikapa.tv/fr/sign-in')
    })

    it('carries no callback in the query string', () => {
      // The sign-in page picks the destination server-side. A destination read
      // from the query would make that form an open redirect, and the studio
      // is not worth that trade.
      expect(signInUrl(sameOrigin, 'en')).not.toContain('?')
    })

    it('uses the site origin, not the studio one, in a split deployment', () => {
      const url = signInUrl(
        { APP_URL: 'https://cms.tv', SITE_URL: 'https://site.tv', STUDIO_URL: 'https://cms.tv' },
        'en',
      )

      expect(url).toBe('https://site.tv/en/sign-in')
    })
  })

  describe('trustedOrigins', () => {
    it('collapses to one entry when both live on the same origin', () => {
      expect(trustedOrigins(sameOrigin)).toStrictEqual(['https://kurasikapa.tv'])
    })

    it('lists both origins when the studio has its own host', () => {
      // Without the studio origin here, Better Auth drops the OAuth callback
      // and the editor lands on the public homepage, signed in but lost.
      expect(
        trustedOrigins({
          APP_URL: 'https://site.tv',
          SITE_URL: 'https://site.tv',
          STUDIO_URL: 'https://cms.tv/studio',
        }),
      ).toStrictEqual(['https://site.tv', 'https://cms.tv'])
    })
  })

  describe('cookieScope', () => {
    it('stays host-scoped when no parent domain is configured', () => {
      // Same-origin needs no widening, and widening a session cookie is a
      // decision someone should have to make on purpose.
      expect(cookieScope(undefined)).toStrictEqual({})
      expect(cookieScope('')).toStrictEqual({})
    })

    it('widens to the parent domain so the studio subdomain sees the session', () => {
      expect(cookieScope('.kurasikapa.tv')).toStrictEqual({
        crossSubDomainCookies: { enabled: true, domain: '.kurasikapa.tv' },
      })
    })
  })
})
