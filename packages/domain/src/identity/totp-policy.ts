/**
 * The rules around time-based one-time codes (RFC 6238).
 *
 * The HMAC itself is arithmetic and belongs in an adapter. What lives here is
 * every decision that has a consequence: how wide the acceptance window is,
 * what a code looks like, and what makes a previously-correct code stop being
 * correct.
 */

/** RFC 6238's default, and what every authenticator app assumes. */
export const TIME_STEP_SECONDS = 30

/** Six digits is the universal default; changing it breaks every scanner. */
export const CODE_DIGITS = 6

/**
 * How many steps either side of "now" are accepted.
 *
 * One step — so a 90-second window in total. This is the whole trade-off:
 *
 * - Narrower (0) rejects a phone whose clock is fifteen seconds out, which is
 *   common enough that people conclude 2FA is broken and turn it off.
 * - Wider (2, 3) is the usual over-correction, and every extra step is another
 *   30 seconds in which an observed code still works.
 *
 * ±1 is what RFC 6238 § 5.2 recommends, for these reasons.
 */
export const DRIFT_STEPS = 1

export class InvalidTotpCode extends Error {
  constructor() {
    super('That code was not accepted.')
    this.name = 'InvalidTotpCode'
  }
}

export class TotpCodeAlreadyUsed extends Error {
  constructor() {
    super('That code was not accepted.')
    this.name = 'TotpCodeAlreadyUsed'
  }
}

/** The counter an authenticator is showing at this instant. */
export function counterAt(now: Date): number {
  return Math.floor(now.getTime() / 1000 / TIME_STEP_SECONDS)
}

/**
 * Every counter that should be accepted right now, nearest first.
 *
 * Nearest first is not cosmetic: the caller compares in order, and the
 * overwhelmingly common case is the current step, so the usual path does one
 * HMAC rather than three.
 */
export function acceptableCounters(now: Date): number[] {
  const current = counterAt(now)
  const counters = [current]

  for (let offset = 1; offset <= DRIFT_STEPS; offset += 1) {
    counters.push(current - offset, current + offset)
  }

  return counters
}

/**
 * Refuses a code from a step at or before the last one this account used.
 *
 * Without this, the drift window is a replay window: a code shoulder-surfed or
 * captured from a phishing page stays valid for up to 90 seconds, and 2FA
 * stops being a second FACTOR and becomes a second password with a short life.
 *
 * `lastUsedCounter` is null for an account that has never verified.
 */
export function assertNotReplayed(counter: number, lastUsedCounter: number | null): void {
  if (lastUsedCounter !== null && counter <= lastUsedCounter) throw new TotpCodeAlreadyUsed()
}

/** Normalises what people actually type: spaces, and sometimes a hyphen. */
export function normaliseCode(raw: string): string {
  return raw.replace(/[\s-]/gu, '')
}

export function isWellFormedCode(raw: string): boolean {
  return new RegExp(`^\\d{${String(CODE_DIGITS)}}$`, 'u').test(normaliseCode(raw))
}

/**
 * How many single-use recovery codes an enrolment gets.
 *
 * Enough that losing a phone is recoverable without a support conversation,
 * few enough that a printed list is not a second password file.
 */
export const RECOVERY_CODE_COUNT = 10
