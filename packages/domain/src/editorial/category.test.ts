import { describe, expect, it } from 'vitest'
import { categoryId } from '../shared/ids'
import { Category, LocaleNotCovered } from './category'

const politics = (over: Partial<Parameters<typeof Category.reconstitute>[0]> = {}): Category =>
  Category.reconstitute({
    id: categoryId('cat_politics'),
    parentId: null,
    slugs: { en: 'politics', fr: 'politique' },
    names: { en: 'Politics', fr: 'Politique' },
    descriptions: { en: 'Power, policy and the people who wield both.' },
    order: 1,
    ...over,
  })

describe('slugIn', () => {
  it('gives each locale its own slug', () => {
    // A French reader should land on /fr/rubriques/politique, not on an
    // English word. "Locale is data" applies to navigation too.
    expect(politics().slugIn('en').value).toBe('politics')
    expect(politics().slugIn('fr').value).toBe('politique')
  })

  it('refuses a locale it does not cover', () => {
    expect(() => politics().slugIn('tw')).toThrow(LocaleNotCovered)
  })

  it('names the locale in the error', () => {
    expect(() => politics().slugIn('tw')).toThrow(/"tw"/u)
  })
})

describe('coversLocale', () => {
  it('is true for a locale with a slug', () => {
    expect(politics().coversLocale('fr')).toBe(true)
  })

  it('is false otherwise — which is how a section rolls out one language at a time', () => {
    expect(politics().coversLocale('tw')).toBe(false)
  })
})

describe('nameIn', () => {
  it('returns the name for the locale', () => {
    expect(politics().nameIn('fr')).toBe('Politique')
  })

  it('falls back to another language rather than rendering an empty heading', () => {
    // Visibly imperfect beats invisibly broken, and it makes the missing
    // translation obvious to whoever can fix it.
    const partial = politics({ names: { en: 'Politics' } })

    expect(partial.nameIn('fr')).toBe('Politics')
  })

  it('returns an empty string when it has no names at all', () => {
    expect(politics({ names: {} }).nameIn('en')).toBe('')
  })
})

describe('hierarchy', () => {
  it('knows a top-level section', () => {
    expect(politics().isRootLevel()).toBe(true)
  })

  it('knows a child section', () => {
    const child = politics({ parentId: categoryId('cat_news') })

    expect(child.isRootLevel()).toBe(false)
    expect(child.parentId).toBe('cat_news')
  })
})

describe('descriptionIn', () => {
  it('gives the standfirst for a locale that has one', () => {
    expect(politics().descriptionIn('en')).toBe('Power, policy and the people who wield both.')
  })

  it('does NOT fall back to another locale, unlike nameIn', () => {
    // Deliberate asymmetry. A heading in the wrong language is a visible
    // glitch someone fixes; a whole paragraph in the wrong language reads as
    // a broken translation to every French reader who lands on the section.
    expect(politics().descriptionIn('fr')).toBeNull()
    expect(politics().nameIn('fr')).toBe('Politique')
  })

  it('is null when the section has no descriptions at all', () => {
    expect(politics({ descriptions: {} }).descriptionIn('en')).toBeNull()
  })
})
