import { COVERAGE_FLOORS, baseConfig } from '@kurasikapa/config/vitest'
import { defineConfig, mergeConfig } from 'vitest/config'

/**
 * The public site.
 *
 * Most of what this app used to be measured on — the composition root, the BFF
 * seam, read models, locale routing, the security policy — moved to
 * @kurasikapa/web-kit when the studio became its own deployment (ADR-0011),
 * and is measured there against the same floor. What is left here is the
 * reader-facing surface, so the exclusions below are shorter than they were:
 * the entries for modules that no longer live in this app were removed rather
 * than left to rot into a list nobody trusts.
 */
const base = baseConfig(COVERAGE_FLOORS.web, [
  // Server Actions only run inside Next. Their logic lives in web-kit's
  // schemas.ts and result.ts, both covered there.
  'src/actions/reader-actions.ts',
  'src/actions/newsletter-actions.ts',
  'src/actions/contact-actions.ts',
  'src/actions/account-actions.ts',
  'src/actions/push.ts',
  'src/actions/invitations.ts',
  // Vendor client construction, browser-only — the same category as web-kit's
  // composition/auth.ts. Exercised by the auth E2E journey.
  'src/lib/auth-client.ts',
  // Configuration handed to next-intl, and it only resolves inside a request.
  // The routing it reads is web-kit's, and is measured there.
  'src/i18n/request.ts',
  // Presentational only — no branching worth a unit test. Covered by the
  // Playwright journeys, which is where markup belongs under test.
  'src/components/**/*.tsx',
  'src/content/markdown-view.tsx',
  'src/content/standing-route.tsx',
  // Request-time composition only; structured entry decoding is covered in
  // web-kit and the rendered markup belongs to the standing-page E2E path.
  'src/content/cms-page.ts',
  'src/analytics/**/*.tsx',
  'src/pwa/service-worker-register.tsx',
  // Opt-in is gated on production SW + Notification; covered by the policy
  // unit tests and the fail-closed VAPID path in web-kit's outbound.test.ts.
  'src/pwa/push-opt-in.tsx',
])

export default mergeConfig(
  base,
  defineConfig({
    test: {
      // Hooks need a DOM. Unit tests do not, but one environment for the
      // package is simpler than two projects for the sake of a few files.
      environment: 'happy-dom',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
  }),
)
