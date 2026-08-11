import { COVERAGE_FLOORS, baseConfig } from '@kurasikapa/config/vitest'
import { defineConfig, mergeConfig } from 'vitest/config'

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
  // Server Actions and subscriber wiring only run inside Next. Their logic
  // lives in schemas.ts, result.ts and cache-invalidation.ts, all covered here.
  'src/actions/editorial.ts',
  'src/actions/ai.ts',
  'src/actions/side-actions.ts',
  'src/actions/newsletter-actions.ts',
  'src/actions/push.ts',
  'src/composition/subscribers.ts',
  'src/composition/announce-published.ts',
  'src/composition/announce-transition.ts',
  // Presentational only — no branching worth a unit test. Covered by the
  // Playwright journeys, which is where markup belongs under test.
  'src/components/**/*.tsx',
  'src/pwa/service-worker-register.tsx',
  // Opt-in is gated on production SW + Notification; covered by the policy
  // unit tests and the fail-closed VAPID path in outbound.test.ts.
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
