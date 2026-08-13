import { COVERAGE_FLOORS, baseConfig } from '@kurasikapa/config/vitest'
import { defineConfig, mergeConfig } from 'vitest/config'

const base = baseConfig(COVERAGE_FLOORS.web, [
  // Server Actions only run inside Next. Their logic lives in web-kit's
  // schemas.ts, result.ts and cache-invalidation.ts, all covered there.
  'src/actions/**',
  // A dispatch table over those same Server Actions — it imports every
  // `'use server'` module in actions/ai.ts, so it cannot load under a plain
  // Vitest process for exactly the reason the line above gives. What it holds
  // beyond the wiring is a label map.
  'src/components/assists.ts',
  // Locale routing is configuration handed to next-intl, not logic of ours.
  'src/i18n/**',
  // A compile-time cast with no runtime behaviour: `url as Route`. A test
  // would assert that an identity function is the identity function.
  'src/external-route.ts',
  // Presentational only — no branching worth a unit test. Covered by the
  // Playwright journeys, which is where markup belongs under test.
  'src/components/**/*.tsx',
])

export default mergeConfig(
  base,
  defineConfig({
    test: {
      // The autosave and generate hooks need a DOM.
      environment: 'happy-dom',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
  }),
)
