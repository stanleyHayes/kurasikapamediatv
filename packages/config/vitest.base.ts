import { type ViteUserConfig, defineConfig } from 'vitest/config'

/**
 * Coverage floors per layer — docs/07-quality-gates.md § 3.
 * The domain floor is highest because domain tests are the cheapest to write
 * and the place where a bug is most expensive to ship.
 */
export const COVERAGE_FLOORS = {
  domain: 95,
  application: 90,
  adapter: 80,
  web: 80,
} as const

/**
 * Adapter suites start a real container, so they need room. Unit suites do not
 * and should stay fast — a generous default timeout hides hangs.
 */
const CONTAINER_STARTUP_MS = 120_000

export function integrationConfig(floor: number): ViteUserConfig {
  const config = baseConfig(floor)

  return defineConfig({
    ...config,
    test: {
      ...config.test,
      testTimeout: CONTAINER_STARTUP_MS,
      hookTimeout: CONTAINER_STARTUP_MS,
      // One container per file, reused across that file's tests.
      fileParallelism: false,
    },
  })
}

/**
 * `exclude` is for code that cannot be unit-tested at all — a framework
 * boundary compiled by Next, for instance. It is not an escape hatch for code
 * that is merely awkward to test, and every entry should say why in the caller.
 */
export function baseConfig(floor: number, exclude: readonly string[] = []): ViteUserConfig {
  return defineConfig({
    test: {
      globals: false,
      environment: 'node',
      include: ['src/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.test.ts', 'src/testing/**', 'src/index.ts', ...exclude],
        thresholds: {
          lines: floor,
          functions: floor,
          branches: floor,
          statements: floor,
        },
      },
    },
  })
}
