/**
 * An email address, normalised once so two spellings of one inbox cannot
 * become two accounts.
 *
 * Normalisation is deliberately conservative: trim and lowercase, nothing
 * else. It does NOT strip dots or `+tags`, because whether `a.b@gmail.com` and
 * `ab@gmail.com` are the same inbox is a Gmail policy, not an email one — and
 * applying Gmail's rules to every domain silently merges accounts that were
 * never the same person.
 *
 * Validation is deliberately loose for the same reason. RFC 5322 permits far
 * more than any regex people write for it, and the only real proof an address
 * exists is that a message sent to it arrives. This rejects what cannot
 * possibly be an address, and leaves the rest to the confirmation email.
 */
export class InvalidEmailAddress extends Error {
  constructor(readonly value: string) {
    super(`"${value}" is not an email address`)
    this.name = 'InvalidEmailAddress'
  }
}

const MAX_LENGTH = 254 // RFC 5321 §4.5.3.1 — the longest a path may be.

export class EmailAddress {
  private constructor(readonly value: string) {}

  static of(raw: string): EmailAddress {
    const normalised = raw.trim().toLowerCase()

    if (!isPlausible(normalised)) throw new InvalidEmailAddress(raw)

    return new EmailAddress(normalised)
  }

  /** The part a greeting can use when no display name was given. */
  get localPart(): string {
    return this.value.slice(0, this.value.lastIndexOf('@'))
  }

  get domain(): string {
    return this.value.slice(this.value.lastIndexOf('@') + 1)
  }

  equals(other: EmailAddress): boolean {
    return this.value === other.value
  }

  toString(): string {
    return this.value
  }
}

function isPlausible(value: string): boolean {
  if (value.length === 0 || value.length > MAX_LENGTH) return false
  if (/\s/u.test(value)) return false

  const at = value.lastIndexOf('@')
  if (at <= 0 || at === value.length - 1) return false

  const domain = value.slice(at + 1)

  // A domain with no dot is either localhost or a typo, and neither can
  // receive a confirmation email from a production sender.
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.')
}
