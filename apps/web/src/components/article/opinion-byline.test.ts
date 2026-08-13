import { describe, expect, it } from 'vitest'
import { isOpinionArticle, opinionDisclaimer, OPINION_CATEGORY_IDS } from './opinion-byline'

describe('isOpinionArticle', () => {
  it('flags the PRD opinion categories by id', () => {
    expect(isOpinionArticle('cat_opinion')).toBe(true)
    expect(isOpinionArticle('cat_editorial')).toBe(true)
  })

  it('leaves news categories on the standard byline', () => {
    expect(isOpinionArticle('cat_business')).toBe(false)
    expect(isOpinionArticle('cat_culture')).toBe(false)
  })

  it('matches on id, never on a translated name or slug', () => {
    // An Éditorial is still an editorial — a name match would miss the French.
    expect([...OPINION_CATEGORY_IDS].every((id) => id.startsWith('cat_'))).toBe(true)
  })
})

describe('opinionDisclaimer', () => {
  it('attributes the views to the author in both locales', () => {
    expect(opinionDisclaimer('en')).toMatch(/author's own/u)
    expect(opinionDisclaimer('fr')).toMatch(/l'auteur/u)
  })

  it('defaults to English for an unknown locale', () => {
    expect(opinionDisclaimer('tw')).toBe(opinionDisclaimer('en'))
  })
})
