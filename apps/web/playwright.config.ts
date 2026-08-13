import { defineConfig, devices } from '@playwright/test'

// Distinctive on purpose. 3000/3100 collide with whatever else a developer
// has running, and a journey that silently tests someone else's server is
// worse than one that fails.
const PORT = 31_742
const BASE_URL = `http://127.0.0.1:${String(PORT)}`

/**
 * Journeys run against a production build, not `next dev`.
 *
 * Cache Components, Partial Prerendering and Server Action serialisation all
 * behave differently in dev. A journey that only passes against the dev server
 * proves the dev server works.
 */
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
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    // Seeds BEFORE the build (see e2e/prebuild-seed.ts for why), then builds,
    // deliberately. `next start` serves whatever is already in .next, so
    // without the build this suite silently tests a stale build — the same
    // failure mode as reusing a foreign server, and harder to notice because
    // the tests still pass, just against the wrong code.
    command: `node e2e/prebuild-seed.ts && pnpm exec next build && pnpm exec next start --port ${String(PORT)}`,
    url: BASE_URL,
    // Never reuse. A stale or foreign server on this port would be tested
    // instead of the build under test — which is exactly what happened the
    // first time these journeys ran.
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      MONGODB_URI: process.env['MONGODB_URI'] ?? 'mongodb://127.0.0.1:37017/kurasikapa_e2e?directConnection=true',
      MONGODB_DB: 'kurasikapa_e2e',
      APP_URL: BASE_URL,
      BETTER_AUTH_SECRET: process.env['BETTER_AUTH_SECRET'] ?? 'e2e-secret-not-for-production-0123456789',
    },
  },
})
