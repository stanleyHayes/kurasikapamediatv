import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy, securityHeaders } from './headers'

const directives = (isDev: boolean): Map<string, string> =>
  new Map(
    contentSecurityPolicy(isDev)
      .split('; ')
      .map((part) => {
        const [name, ...values] = part.split(' ')

        return [name ?? '', values.join(' ')]
      }),
  )

describe('contentSecurityPolicy', () => {
  it('never ships unsafe-eval to production', () => {
    // Dev-only: React uses eval to rebuild server error stacks in the browser.
    // In production it hands an injected string a way to execute.
    expect(contentSecurityPolicy(false)).not.toContain('unsafe-eval')
    expect(contentSecurityPolicy(true)).toContain('unsafe-eval')
  })

  it('refuses to be framed', () => {
    // Clickjacking a publish button is a real attack on a newsroom.
    expect(directives(false).get('frame-ancestors')).toBe("'none'")
  })

  it('allows no plugins and only the Turnstile challenge frame', () => {
    expect(directives(false).get('object-src')).toBe("'none'")
    expect(directives(false).get('frame-src')).toBe('https://challenges.cloudflare.com')
  })

  it('confines service workers to this origin', () => {
    expect(directives(false).get('worker-src')).toBe("'self'")
  })

  it('confines form posts and base URIs to this origin', () => {
    // A rewritten <base> turns every relative URL into an attacker's, and a
    // form-action elsewhere turns the sign-in form into a credential drop.
    expect(directives(false).get('form-action')).toBe("'self'")
    expect(directives(false).get('base-uri')).toBe("'self'")
  })

  it('does not use a nonce, which would disable Partial Prerendering', () => {
    // Not an omission. A nonce forces every page dynamic, which is
    // incompatible with cacheComponents — the whole caching architecture.
    // If someone adds one, this test should make them read why first.
    expect(contentSecurityPolicy(false)).not.toContain('nonce-')
  })

  it('opens no websocket in production', () => {
    expect(directives(false).get('connect-src')).not.toContain('ws:')
    expect(directives(true).get('connect-src')).toContain('ws:')
  })

  it('names the analytics and Turnstile hosts rather than opening https:', () => {
    const connect = directives(false).get('connect-src') ?? ''
    expect(connect).toContain('https://www.google-analytics.com')
    expect(connect).toContain('https://challenges.cloudflare.com')
    expect(directives(false).get('script-src')).toContain('https://www.googletagmanager.com')
  })

  it('allows only the Amazon IVS playback estate for live media', () => {
    expect(directives(false).get('connect-src')).toContain('https://*.playback.live-video.net')
    expect(directives(false).get('media-src')).toBe(
      "'self' blob: https://*.playback.live-video.net",
    )
  })
})

describe('securityHeaders', () => {
  it('sets a policy for every header the quality gates claim', () => {
    const headers = securityHeaders(false)

    expect(Object.keys(headers)).toEqual(
      expect.arrayContaining([
        'Content-Security-Policy',
        'Strict-Transport-Security',
        'X-Content-Type-Options',
        'Referrer-Policy',
        'X-Frame-Options',
        'Permissions-Policy',
        'Cross-Origin-Opener-Policy',
        'Cross-Origin-Resource-Policy',
        'Origin-Agent-Cluster',
        'X-DNS-Prefetch-Control',
      ]),
    )
  })

  it('stops a browser sniffing an uploaded file into a script', () => {
    expect(securityHeaders(false)['X-Content-Type-Options']).toBe('nosniff')
  })

  it('does not leak a studio URL to outbound links', () => {
    // `/studio/articles/<id>` in a Referer tells the linked site what is being
    // written before it is published.
    expect(securityHeaders(false)['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
  })

  it('denies camera, microphone and location outright', () => {
    const policy = securityHeaders(false)['Permissions-Policy'] ?? ''

    expect(policy).toContain('camera=()')
    expect(policy).toContain('microphone=()')
    expect(policy).toContain('geolocation=()')
  })

  it('isolates windows and resources to the site origin', () => {
    const headers = securityHeaders(false)

    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin')
    expect(headers['Cross-Origin-Resource-Policy']).toBe('same-origin')
    expect(headers['Origin-Agent-Cluster']).toBe('?1')
  })

  it('keeps HSTS in development too, so the header cannot be forgotten', () => {
    // It is inert over http on localhost, and making it conditional means the
    // production-only path is the one nobody ever looks at.
    expect(securityHeaders(true)['Strict-Transport-Security']).toContain('max-age=')
  })
})
