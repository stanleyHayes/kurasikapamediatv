import { describe, expect, it } from 'vitest'
import { Actor, SitePage, userId } from '@kurasikapa/domain'
import { ManageSitePages } from './manage-site-pages'
import { GetSitePage } from './get-site-page'
import type { SitePageRepository } from '../ports/site-page-repository'

class MemoryPages implements SitePageRepository {
  readonly pages: SitePage[] = []
  find(_key?: string, _locale?: string): Promise<SitePage | null> { return Promise.resolve(this.pages[0] ?? null) }
  list(_locale?: string): Promise<readonly SitePage[]> { return Promise.resolve(this.pages) }
  save(page: SitePage): Promise<void> { this.pages.push(page); return Promise.resolve() }
}

describe('ManageSitePages', () => {
  it('lets a publisher save localized standing-page content', async () => {
    const pages = new MemoryPages()
    const actor = new Actor(userId('usr_editor'), ['editor'])
    await new ManageSitePages({ pages, clock: { now: () => new Date('2026-08-30T20:00:00Z') } }).execute({ actor, key: 'careers', locale: 'en', title: 'Careers', lead: 'Join us', body: 'Independent reporting.' })
    expect((await pages.find('careers', 'en'))?.snapshot().title).toBe('Careers')
  })

  it('refuses a reader', async () => {
    const actor = new Actor(userId('usr_reader'), ['guest'])
    await expect(new ManageSitePages({ pages: new MemoryPages(), clock: { now: () => new Date() } }).execute({ actor, key: 'careers', locale: 'en', title: 'Careers', lead: '', body: 'Copy' })).rejects.toThrow('article:publish')
  })

  it('reads through the repository', async () => {
    const pages = new MemoryPages()
    await pages.save(SitePage.create({ key: 'faq', locale: 'en', title: 'FAQ', lead: '', body: 'Answers', updatedAt: new Date() }))
    expect((await new GetSitePage(pages).execute({ key: 'faq', locale: 'en' }))?.snapshot().body).toBe('Answers')
  })
})
