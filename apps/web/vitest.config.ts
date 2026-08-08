import { COVERAGE_FLOORS, baseConfig } from '@kurasikapa/config/vitest'

export default baseConfig(COVERAGE_FLOORS.web, [
  // `use cache` is a compiler directive. These functions only exist as written
  // once Next has transformed them, so they cannot run under a plain Vitest
  // process. They are covered by the Playwright journeys instead.
  'src/read-model/queries.ts',
  // Locale routing is configuration handed to next-intl, not logic of ours.
  'src/i18n/**',
])
