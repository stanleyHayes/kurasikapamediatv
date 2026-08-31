/**
 * Security response headers.
 *
 * HSTS, X-Content-Type-Options, Referrer-Policy and X-Frame-Options were
 * already set inline in next.config.ts. They move here so the policy can be
 * read, reviewed and TESTED in one place — a CSP nobody can unit-test is a CSP
 * nobody dares change, and a header list buried in a build config is a list
 * nobody audits.
 *
 * What was genuinely missing is Content-Security-Policy and Permissions-Policy.
 */

/**
 * Content-Security-Policy.
 *
 * NONCE-BASED CSP IS NOT USED, AND THAT IS THE WHOLE DECISION.
 *
 * A nonce is the stronger policy and was the first attempt. Next's own
 * documentation is unambiguous about the cost: nonces require every page to
 * be dynamically rendered, which disables static optimisation, disables CDN
 * caching, and is *incompatible with Partial Prerendering* because a static
 * shell has no request to draw a nonce from.
 *
 * This application is built on `cacheComponents: true`. The three-tier model
 * in CLAUDE.md — static shell, `'use cache'` bodies, `<Suspense>` for
 * request data — is the architecture, not a detail of it. Adopting a nonce
 * would have silently turned every cached page dynamic and made the tags,
 * the cacheLife profiles and the publish-time `updateTag` invalidation
 * pointless work.
 *
 * So `'unsafe-inline'` for scripts, knowingly. It is the weaker half of CSP
 * and it is bought with the caching model intact. Everything else stays
 * strict: no objects, no frames, nobody may frame us, forms post only here.
 *
 * The upgrade path is Subresource Integrity (`experimental.sri`), which gives
 * hash-based script integrity while keeping static generation. It is marked
 * experimental, and ADR-0007 is why this codebase does not build load-bearing
 * security on experimental flags. Revisit when it is stable.
 */
export function contentSecurityPolicy(isDev: boolean): string {
  const directives: readonly string[][] = [
    ['default-src', "'self'"],

    // unsafe-eval is dev-only: React uses eval to rebuild server error stacks
    // in the browser. Shipping it would hand an injected string a way to run.
    [
      'script-src',
      "'self'",
      "'unsafe-inline'",
      'https://www.googletagmanager.com',
      'https://challenges.cloudflare.com',
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],

    // Tailwind compiles to a stylesheet, but Next still emits inline style
    // attributes for font loading and view transitions. There is no nonce
    // mechanism for those, and style injection cannot execute script.
    ['style-src', "'self'", "'unsafe-inline'"],

    // data: for the inlined font subsets next/font emits.
    ['font-src', "'self'", 'data:'],

    // Narrow this to the Cloudinary delivery host when MediaPort lands (R3).
    // `https:` is a placeholder wide enough to be worth closing, and naming a
    // host we do not use yet would be theatre.
    ['img-src', "'self'", 'data:', 'blob:', 'https:'],

    [
      'connect-src',
      "'self'",
      'https://www.google-analytics.com',
      'https://*.google-analytics.com',
      'https://www.googletagmanager.com',
      'https://challenges.cloudflare.com',
      'https://*.playback.live-video.net',
      ...(isDev ? ['ws:'] : []),
    ],

    // Amazon IVS playback manifests and segments. Ingest never reaches a
    // browser; only the public playback estate is allowed here.
    ['media-src', "'self'", 'blob:', 'https://*.playback.live-video.net'],

    // No plugins, no embedded frames, and nobody may frame us. Clickjacking a
    // publish button is a real attack on a newsroom.
    ['object-src', "'none'"],
    ['frame-ancestors', "'none'"],
    // Turnstile's challenge is an iframe. Nothing else may frame or be framed.
    ['frame-src', 'https://challenges.cloudflare.com'],

    // Same-origin workers only. The offline reader is a service worker; a
    // blob: or data: worker would be a way to run a script we did not serve.
    ['worker-src', "'self'"],

    ['base-uri', "'self'"],
    ['form-action', "'self'"],
    ['upgrade-insecure-requests'],
  ]

  return directives.map((parts) => parts.join(' ')).join('; ')
}

/** Every security header, in one auditable place. */
export function securityHeaders(isDev: boolean): Readonly<Record<string, string>> {
  return {
    'Content-Security-Policy': contentSecurityPolicy(isDev),

    // Two years, subdomains, and `preload` — which is a real commitment: it
    // asks browsers to hard-code the domain as https-only, and getting removed
    // from the preload list takes months. Kept because it was already the
    // published policy, and a media brand's credibility does not survive a
    // downgrade attack on a byline.
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',

    // Stops a browser deciding an uploaded .txt is really JavaScript.
    'X-Content-Type-Options': 'nosniff',

    // Send the origin cross-site, the full path same-site. A newsroom leaking
    // `/studio/articles/<id>` to an outbound link tells that site what is
    // being written before it is published.
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Redundant with frame-ancestors for modern browsers, kept for old ones.
    'X-Frame-Options': 'DENY',

    // Keep each browsing context and response in our origin's security
    // boundary. This limits cross-window data access and stops another origin
    // treating our HTML or JSON as a loadable resource.
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Origin-Agent-Cluster': '?1',

    // DNS prefetch can disclose navigation intent before consent or a click.
    'X-DNS-Prefetch-Control': 'off',

    // Nothing here needs a camera, a microphone or a location.
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  }
}
