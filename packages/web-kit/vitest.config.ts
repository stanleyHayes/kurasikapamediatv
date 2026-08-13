import { COVERAGE_FLOORS, baseConfig } from '@kurasikapa/config/vitest'
import { defineConfig, mergeConfig } from 'vitest/config'

/**
 * The Next-runtime kit both deployables share: the composition root, the BFF
 * seam to the Go API, read models, locale routing and the security policy.
 *
 * Same floor as an app, because that is what this code used to be — it moved
 * out of apps/web when the studio became its own deployment, not down a layer.
 */
const base = baseConfig(COVERAGE_FLOORS.web, [
  // `use cache` is a compiler directive. These functions only exist as written
  // once Next has transformed them, so they cannot run under a plain Vitest
  // process. They are covered by the Playwright journeys instead.
  'src/read-model/queries.ts',
  // Locale routing is configuration handed to next-intl, not logic of ours.
  'src/i18n/**',
  // Vendor configuration, and building it opens a connection. Exercised by the
  // build and by the auth E2E journey; the logic we own is in auth-providers.ts.
  'src/composition/auth.ts',
  // next/headers only resolves inside a request. The branch that matters —
  // roles resolving to an Actor — is tested in the application layer.
  'src/composition/actor.ts',
  // Subscriber wiring only runs inside Next. Its logic lives in
  // cache-invalidation.ts, which is covered here.
  'src/composition/subscribers.ts',
  'src/composition/announce-published.ts',
  'src/composition/announce-transition.ts',
])

export default mergeConfig(
  base,
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }),
)
