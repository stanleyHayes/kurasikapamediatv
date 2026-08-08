import { describe, expect, it } from 'vitest'
import { PAGES, type PageKey, pageFor } from './pages'

const KEYS: PageKey[] = [
  'about',
  'team',
  'contact',
  'faq',
  'advertise',
  'careers',
  'privacy',
  'terms',
  'cookies',
]

describe('pageFor', () => {
  it.each(KEYS)('returns content for %s', (key) => {
    const page = pageFor(key, 'en')

    expect(page.title).toBeTruthy()
    expect(page.sections.length).toBeGreaterThan(0)
  })

  it('falls back to English for a locale with no catalogue', () => {
    // Legal text and a company's description of itself are the two places a
    // plausible-sounding machine translation does the most damage, so an
    // untranslated locale shows English rather than an approximation.
    expect(pageFor('about', 'tw').title).toBe(pageFor('about', 'en').title)
  })

  it('serves every locale the site routes', () => {
    expect(Object.keys(PAGES).sort()).toEqual(['en', 'fr'])
  })
})

describe('content sourced from the questionnaire', () => {
  it('states the mission in the client’s own words', () => {
    const about = pageFor('about', 'en')
    const text = about.sections.flatMap((s) => s.paragraphs).join(' ')

    expect(text).toContain('educational, motivational and social content')
  })

  it('lists all four stated values', () => {
    const values = pageFor('about', 'en').sections.find((s) => s.heading === 'Our values')

    expect(values?.bullets?.map((b) => b.term)).toEqual([
      'Respect',
      'Integrity',
      'Creativity',
      'Excellence',
    ])
  })

  it('tells readers plainly that AI never publishes unreviewed', () => {
    // The editorial-integrity rule from ADR-0005, said out loud to the public
    // rather than only enforced in code.
    const faq = pageFor('faq', 'en')
    const text = faq.sections.flatMap((s) => s.paragraphs).join(' ')

    expect(text).toContain('named human editor')
  })

  it('states EU data residency on the privacy page', () => {
    const privacy = pageFor('privacy', 'en')
    const text = privacy.sections.flatMap((s) => s.paragraphs).join(' ')

    expect(text).toContain('European Union')
  })
})

describe('provisional copy is declared, not hidden', () => {
  it.each<PageKey>(['team', 'advertise', 'careers', 'privacy', 'terms', 'cookies'])(
    '%s is flagged as awaiting the client’s wording',
    (key) => {
      // A legal page carrying placeholder text without saying so is worse than
      // one that admits it — a reader relying on it deserves to know.
      expect(pageFor(key, 'en').needsClientCopy).toBe(true)
    },
  )

  it.each<PageKey>(['about', 'contact', 'faq'])('%s is not flagged', (key) => {
    expect(pageFor(key, 'en').needsClientCopy).toBeUndefined()
  })
})
