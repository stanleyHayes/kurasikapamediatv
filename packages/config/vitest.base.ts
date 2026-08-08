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

export function baseConfig(floor: number): ViteUserConfig {
  return defineConfig({
    test: {
      globals: false,
      environment: 'node',
      include: ['src/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.test.ts', 'src/testing/**', 'src/index.ts'],
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
