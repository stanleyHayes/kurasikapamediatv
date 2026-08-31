import type { SitePageKey } from '@kurasikapa/domain'
import { connection } from 'next/server'
import { container } from '@kurasikapa/web-kit/composition/container'
import { decodeSitePageEntries, type SitePageEntry } from '@kurasikapa/web-kit/read-model/site-page-entries'
import { type StandingPage, pageFor } from './pages'

export async function cmsPageFor(key: SitePageKey, locale: string): Promise<StandingPage> {
  // Mongo's driver reads the clock while selecting a server. Mark CMS-backed
  // standing pages request-time before that access so Cache Components does
  // not attempt the database call during static prerender.
  await connection()
  const found = await container().getSitePage.execute({ key, locale })
  if (found === null && locale !== 'en') {
    const english = await container().getSitePage.execute({ key, locale: 'en' })
    if (english !== null) return fromCms(english.snapshot())
  }
  return found === null ? pageFor(key, locale) : fromCms(found.snapshot())
}

export async function sitePageEntriesFor(key: SitePageKey, locale: string): Promise<readonly SitePageEntry[]> {
  await connection()
  const found = await container().getSitePage.execute({ key, locale })
  if (found !== null) return decodeSitePageEntries(found.snapshot().body)
  if (locale === 'en') return []
  const english = await container().getSitePage.execute({ key, locale: 'en' })
  return english === null ? [] : decodeSitePageEntries(english.snapshot().body)
}

function fromCms(page: { readonly title: string; readonly lead: string; readonly body: string }): StandingPage {
  return { title: page.title, ...(page.lead === '' ? {} : { lead: page.lead }), sections: [], body: page.body, hero: true }
}
