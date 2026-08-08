import { COVERAGE_FLOORS, baseConfig } from '@kurasikapa/config/vitest'

export default baseConfig(COVERAGE_FLOORS.web, [
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
  // Server Actions and the subscriber wiring only run inside Next. The logic
  // they carry lives in schemas.ts, result.ts and cache-invalidation.ts, each
  // fully covered here.
  'src/actions/editorial.ts',
  'src/composition/subscribers.ts',
])
