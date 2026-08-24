import { defineConfig, devices } from '@playwright/test'

// Distinctive on purpose. 3000/3100 collide with whatever else a developer
// has running, and a journey that silently tests someone else's server is
// worse than one that fails.
const WEB_PORT = 31_742
const STUDIO_PORT = 31_743

const BASE_URL = `http://127.0.0.1:${String(WEB_PORT)}`
const STUDIO_ORIGIN = `http://127.0.0.1:${String(STUDIO_PORT)}`

/**
 * The studio's basePath is part of its URL, so STUDIO_URL carries it. The two
 * servers share the hostname `127.0.0.1` and differ only by port — which is
 * what makes the session work locally, because cookies are scoped by host and
 * ignore the port entirely. In production the same trick is unavailable, hence
 * COOKIE_DOMAIN for the split-origin shape. ADR-0011 § 4.
 */
const STUDIO_URL = `${STUDIO_ORIGIN}/studio`

/**
 * Journeys run against production builds of BOTH deployables, not `next dev`.
 *
 * Both, because the product is one thing even though it ships as two: an
 * editor signs in on the public site and lands in the studio, and that
 * handover — cookie scope, trusted origins, absolute cross-app links — is
 * precisely what the split could break and what a single-app suite could not
 * see. This is a test-time coupling, not a deployment one: neither `next
 * build` needs the other.
 *
 * Cache Components, Partial Prerendering and Server Action serialisation all
 * behave differently in dev. A journey that only passes against the dev server
 * proves the dev server works.
 */
const sharedEnv = {
  MONGODB_URI:
    process.env['MONGODB_URI'] ?? 'mongodb://127.0.0.1:37017/kurasikapa_e2e?directConnection=true',
  MONGODB_DB: 'kurasikapa_e2e',
  BETTER_AUTH_SECRET:
    process.env['BETTER_AUTH_SECRET'] ?? 'e2e-secret-not-for-production-0123456789',
  SITE_URL: BASE_URL,
  STUDIO_URL,
  // Both servers, same value: the studio posts cache invalidations to the site
  // and the site verifies them. Unset, a publish raises a reported failure —
  // correct in production, just noise in a journey that never publishes.
  REVALIDATE_SECRET: 'e2e-revalidate-secret-not-for-production-0123456789',
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] === undefined ? 0 : 1,
  workers: 1,
  reporter: process.env['CI'] === undefined ? 'list' : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    /*
     * The axe sweep must measure colours, not animation frames.
     *
     * `.reveal` fades content in over 760ms. axe samples whenever the page
     * happens to be ready, so a heading caught mid-fade is reported as a
     * contrast failure at whatever opacity it had reached — a real-looking
     * violation that appears and disappears with machine load, and names a
     * colour that exists for less than a second.
     *
     * Reduced motion is a setting the theme already honours by dropping the
     * spatial movement and the fades, so this audits a state real users get,
     * and every measurement is of the final colour.
     */
    contextOptions: { reducedMotion: 'reduce' },
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: [
    {
      // Seeds BEFORE the build (see e2e/prebuild-seed.ts for why), then builds,
      // deliberately. `next start` serves whatever is already in .next, so
      // without the build this suite silently tests a stale build — the same
      // failure mode as reusing a foreign server, and harder to notice because
      // the tests still pass, just against the wrong code.
      command: `node e2e/prebuild-seed.ts && pnpm exec next build && pnpm exec next start --port ${String(WEB_PORT)}`,
      url: BASE_URL,
      // Never reuse. A stale or foreign server on this port would be tested
      // instead of the build under test — which is exactly what happened the
      // first time these journeys ran.
      reuseExistingServer: false,
      timeout: 300_000,
      env: { ...sharedEnv, APP_URL: BASE_URL },
    },
    {
      command: `pnpm exec next build && pnpm exec next start --port ${String(STUDIO_PORT)}`,
      cwd: '../studio',
      // `port`, not `url`: every studio route redirects an anonymous visitor to
      // the site's sign-in, so a readiness probe on `/` would chase a redirect
      // to a server that may not be listening yet and call the studio broken.
      port: STUDIO_PORT,
      reuseExistingServer: false,
      timeout: 300_000,
      env: { ...sharedEnv, APP_URL: STUDIO_ORIGIN },
    },
  ],
})
