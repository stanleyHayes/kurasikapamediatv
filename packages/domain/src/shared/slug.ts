/**
 * A URL path segment for one article in one locale.
 *
 * Slugs are not lowercased ASCII only — Kurasikapa publishes in local languages
 * whose orthographies use characters outside a-z (Twi `ɛ`, `ɔ`). Stripping them
 * would mangle the word, so we allow any Unicode letter or digit and normalise
 * separators instead.
 */
const SEPARATORS = /[\s_/\\]+/gu
const DISALLOWED = /[^\p{L}\p{N}-]/gu
const COLLAPSE = /-{2,}/gu
const TRIM = /^-+|-+$/gu

// Deliberately not the `g` variant above: a global regex carries `lastIndex`
// between calls, so reusing it for `.test()` makes validation alternate.
const HAS_DISALLOWED = /[^\p{L}\p{N}-]/u

const MAX_LENGTH = 120

export class InvalidSlug extends Error {
  constructor(reason: string) {
    super(`Invalid slug: ${reason}`)
    this.name = 'InvalidSlug'
  }
}

export class Slug {
  private constructor(readonly value: string) {}

  static fromTitle(title: string): Slug {
    const normalised = title
      .normalize('NFC')
      .toLocaleLowerCase()
      .replace(SEPARATORS, '-')
      .replace(DISALLOWED, '')
      .replace(COLLAPSE, '-')
      .replace(TRIM, '')

    return Slug.of(normalised)
  }

  static of(value: string): Slug {
    if (value === '') throw new InvalidSlug('must not be empty')
    if (value.length > MAX_LENGTH) throw new InvalidSlug(`must be at most ${String(MAX_LENGTH)} characters`)
    if (HAS_DISALLOWED.test(value)) throw new InvalidSlug('contains disallowed characters')
    if (value.startsWith('-') || value.endsWith('-')) throw new InvalidSlug('must not start or end with a hyphen')

    return new Slug(value)
  }

  equals(other: Slug): boolean {
    return this.value === other.value
  }

  toString(): string {
    return this.value
  }
}
