import { describe, expect, it } from 'vitest'
import { InvalidSlug, Slug } from './slug'

describe('Slug.fromTitle', () => {
  it('lowercases and hyphenates', () => {
    expect(Slug.fromTitle('Budget 2026 Explained').value).toBe('budget-2026-explained')
  })

  it('drops punctuation', () => {
    expect(Slug.fromTitle("Ghana's Economy: What Now?").value).toBe('ghanas-economy-what-now')
  })

  it('collapses repeated separators', () => {
    expect(Slug.fromTitle('Sports   —   Live').value).toBe('sports-live')
  })

  it('trims leading and trailing hyphens', () => {
    expect(Slug.fromTitle('!! Breaking !!').value).toBe('breaking')
  })

  it('keeps Twi orthography intact', () => {
    // Stripping to ASCII would turn "sikasɛm" into "sikasm" — a different word.
    expect(Slug.fromTitle('Sikasɛm 2026').value).toBe('sikasɛm-2026')
  })

  it('keeps accented French intact', () => {
    expect(Slug.fromTitle('Élection Présidentielle').value).toBe('élection-présidentielle')
  })

  it('rejects a title that reduces to nothing', () => {
    expect(() => Slug.fromTitle('!!! ???')).toThrow(InvalidSlug)
  })
})

describe('Slug.of', () => {
  it('accepts an already-valid slug', () => {
    expect(Slug.of('budget-2026').value).toBe('budget-2026')
  })

  it('rejects an empty slug', () => {
    expect(() => Slug.of('')).toThrow(InvalidSlug)
  })

  it('rejects disallowed characters', () => {
    expect(() => Slug.of('budget/2026')).toThrow(InvalidSlug)
  })

  it('rejects a leading hyphen', () => {
    expect(() => Slug.of('-budget')).toThrow(InvalidSlug)
  })

  it('rejects a trailing hyphen', () => {
    expect(() => Slug.of('budget-')).toThrow(InvalidSlug)
  })

  it('rejects a slug over 120 characters', () => {
    expect(() => Slug.of('a'.repeat(121))).toThrow(InvalidSlug)
  })

  it('validates consistently when called repeatedly', () => {
    // Guards the stateful-regex bug: a global regex reused for .test()
    // carries lastIndex and alternates between pass and fail.
    for (let i = 0; i < 5; i++) {
      expect(() => Slug.of('budget/2026')).toThrow(InvalidSlug)
    }
  })
})

describe('equality', () => {
  it('compares by value', () => {
    expect(Slug.of('a-b').equals(Slug.of('a-b'))).toBe(true)
    expect(Slug.of('a-b').equals(Slug.of('a-c'))).toBe(false)
  })

  it('stringifies to its value', () => {
    expect(String(Slug.of('a-b'))).toBe('a-b')
  })
})
