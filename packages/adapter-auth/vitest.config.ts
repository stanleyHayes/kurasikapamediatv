import { COVERAGE_FLOORS, baseConfig } from '@kurasikapa/config/vitest'
import { defineConfig, mergeConfig } from 'vitest/config'

/**
 * Vitest's default `testTimeout` is 5000ms, which is sized for unit tests.
 *
 * Password hashing here is a memory-hard KDF running at OWASP's parameters
 * (N=2^16, r=8, p=2 — roughly 67MB and a deliberate ~1s per call). A test that
 * hashes and then verifies does that work twice. Idle, the suite finishes in
 * about two seconds; under `turbo run test`, where every package's pool is
 * competing for cores, individual calls stretch past 2.5s and two of them blow
 * the default.
 *
 * That produces the worst kind of red build: it passes on a developer's idle
 * laptop and fails on a loaded CI runner, so it reads as flakiness rather than
 * as the timeout being wrong. The fix is the timeout, NOT the parameters —
 * those are load-bearing security and making them cheaper to suit a test
 * budget would weaken every password in the system.
 */
const SLOW_KDF_TIMEOUT_MS = 30_000

export default mergeConfig(
  baseConfig(COVERAGE_FLOORS.adapter),
  defineConfig({
    test: {
      testTimeout: SLOW_KDF_TIMEOUT_MS,
      hookTimeout: SLOW_KDF_TIMEOUT_MS,
    },
  }),
)
