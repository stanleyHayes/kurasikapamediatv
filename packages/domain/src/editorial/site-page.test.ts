import { describe, expect, it } from 'vitest'
import { EmptyPageContent, SitePage } from './site-page'

describe('SitePage', () => {
  it('normalises editable content and records publication time', () => {
    const page = SitePage.create({ key: 'careers', locale: 'en', title: ' Careers ', lead: ' Join us ', body: '## Open roles\n\nTell the truth.', updatedAt: new Date('2026-08-30T20:00:00Z') })
    expect(page.snapshot()).toMatchObject({ id: 'careers:en', title: 'Careers', lead: 'Join us' })
  })

  it('refuses empty title or body', () => {
    expect(() => SitePage.create({ key: 'faq', locale: 'en', title: '', lead: '', body: 'Text', updatedAt: new Date() })).toThrow(EmptyPageContent)
    expect(() => SitePage.create({ key: 'faq', locale: 'en', title: 'FAQ', lead: '', body: '', updatedAt: new Date() })).toThrow(EmptyPageContent)
  })
})
