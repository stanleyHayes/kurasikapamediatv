/**
 * What counts as an acceptable password.
 *
 * Deliberately NOT the familiar "one uppercase, one digit, one symbol" rule.
 * NIST SP 800-63B withdrew composition rules because they demonstrably make
 * passwords worse: people satisfy them with `Password1!` and then reuse it.
 * Length is the property that actually resists guessing, so length is what
 * this enforces.
 *
 * The three checks below are the ones with evidence behind them:
 *
 * 1. A floor on length.
 * 2. A ceiling on length — not for security, but because every password goes
 *    through a deliberately slow hash. Without a cap, a megabyte of input is a
 *    denial-of-service against our own CPU. The cap is far above any real
 *    passphrase.
 * 3. A refusal to accept a password that contains the account's own email
 *    local part, which is the single most common guessable choice.
 *
 * Checking against a breached-password corpus is the other measure NIST
 * recommends. It needs a data source, so it is a port at the application
 * layer, not a rule here.
 */
const MIN_LENGTH = 12
const MAX_LENGTH = 256

export class PasswordTooShort extends Error {
  constructor(readonly minimum: number = MIN_LENGTH) {
    super(`A password must be at least ${String(minimum)} characters`)
    this.name = 'PasswordTooShort'
  }
}

export class PasswordTooLong extends Error {
  constructor(readonly maximum: number = MAX_LENGTH) {
    super(`A password may be at most ${String(maximum)} characters`)
    this.name = 'PasswordTooLong'
  }
}

export class PasswordContainsIdentity extends Error {
  constructor() {
    super('A password must not contain your email address')
    this.name = 'PasswordContainsIdentity'
  }
}

export const PASSWORD_RULES = {
  minLength: MIN_LENGTH,
  maxLength: MAX_LENGTH,
} as const

/**
 * Throws on the first rule broken, so a form can show one clear reason rather
 * than a list the reader has to work through.
 *
 * Takes the raw string. It is checked and then immediately handed to a hasher;
 * nothing in the domain stores it.
 */
export function assertAcceptablePassword(password: string, emailLocalPart?: string): void {
  // Length in code points, not UTF-16 units: a passphrase of emoji or CJK
  // characters is not one third as strong as it looks, and `.length` would say
  // it was longer than it is.
  const length = [...password].length

  if (length < MIN_LENGTH) throw new PasswordTooShort()
  if (length > MAX_LENGTH) throw new PasswordTooLong()

  if (emailLocalPart !== undefined && emailLocalPart !== '') {
    if (password.toLowerCase().includes(emailLocalPart.toLowerCase())) {
      throw new PasswordContainsIdentity()
    }
  }
}
