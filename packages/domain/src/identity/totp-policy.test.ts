import { describe, expect, it } from 'vitest'
import {
  CODE_DIGITS,
  DRIFT_STEPS,
  TIME_STEP_SECONDS,
  TotpCodeAlreadyUsed,
  acceptableCounters,
  assertNotReplayed,
  counterAt,
  isWellFormedCode,
  normaliseCode,
} from './totp-policy'

const NOW = new Date('2026-08-14T10:00:00.000Z')

describe('counterAt', () => {
  it('advances once per time step', () => {
    const later = new Date(NOW.getTime() + TIME_STEP_SECONDS * 1000)

    expect(counterAt(later)).toBe(counterAt(NOW) + 1)
  })

  it('does not advance within a step', () => {
    const nearlyLater = new Date(NOW.getTime() + (TIME_STEP_SECONDS - 1) * 1000)

    expect(counterAt(nearlyLater)).toBe(counterAt(NOW))
  })

  it('uses the 30-second step every authenticator app assumes', () => {
    expect(TIME_STEP_SECONDS).toBe(30)
  })
})

describe('acceptableCounters', () => {
  it('accepts the current step first', () => {
    // Order matters for cost: the common case must be the first comparison, so
    // a normal sign-in does one HMAC rather than three.
    expect(acceptableCounters(NOW)[0]).toBe(counterAt(NOW))
  })

  it('accepts exactly one step either side', () => {
    const current = counterAt(NOW)

    expect([...acceptableCounters(NOW)].sort((a, b) => a - b)).toStrictEqual([
      current - 1,
      current,
      current + 1,
    ])
  })

  it('holds the window to 90 seconds', () => {
    // Every extra step is another 30 seconds in which an observed code still
    // works. RFC 6238 §5.2 recommends one.
    expect(DRIFT_STEPS).toBe(1)
    expect(acceptableCounters(NOW)).toHaveLength(2 * DRIFT_STEPS + 1)
  })
})

describe('assertNotReplayed', () => {
  const current = counterAt(NOW)

  it('accepts the first code an account ever uses', () => {
    expect(() => assertNotReplayed(current, null)).not.toThrow()
  })

  it('accepts a code from a later step than the last one used', () => {
    expect(() => assertNotReplayed(current, current - 1)).not.toThrow()
  })

  it('refuses the same code twice', () => {
    // Without this the drift window IS a replay window, and a captured code
    // stays good for up to 90 seconds.
    expect(() => assertNotReplayed(current, current)).toThrow(TotpCodeAlreadyUsed)
  })

  it('refuses an EARLIER code, which is the drift window being replayed', () => {
    // The attacker's code is one step behind the one the reader just used.
    expect(() => assertNotReplayed(current - 1, current)).toThrow(TotpCodeAlreadyUsed)
  })

  it('says nothing that distinguishes replay from a wrong code', () => {
    expect(new TotpCodeAlreadyUsed().message).toBe('That code was not accepted.')
  })
})

describe('code formatting', () => {
  it('strips what people actually type', () => {
    // Authenticator apps display "123 456"; some people type the hyphen too.
    expect(normaliseCode(' 123 456 ')).toBe('123456')
    expect(normaliseCode('123-456')).toBe('123456')
  })

  it.each([
    ['plain six digits', '123456', true],
    ['spaced, as displayed', '123 456', true],
    ['too short', '12345', false],
    ['too long', '1234567', false],
    ['letters', '12345a', false],
    ['empty', '', false],
  ])('%s -> %s', (_why, input, expected) => {
    expect(isWellFormedCode(input)).toBe(expected)
  })

  it('expects six digits, which is what every scanner assumes', () => {
    expect(CODE_DIGITS).toBe(6)
  })
})
