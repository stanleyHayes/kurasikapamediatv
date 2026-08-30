import type { SitePageKey } from '@kurasikapa/domain'
import { container } from '@kurasikapa/web-kit/composition/container'
import { type StandingPage, pageFor } from './pages'

export async function cmsPageFor(key: SitePageKey, locale: string): Promise<StandingPage> {
  const found = await container().getSitePage.execute({ key, locale })
  if (found === null && locale !== 'en') {
    const english = await container().getSitePage.execute({ key, locale: 'en' })
    if (english !== null) return fromCms(english.snapshot())
  }
  return found === null ? pageFor(key, locale) : fromCms(found.snapshot())
}

function fromCms(page: { readonly title: string; readonly lead: string; readonly body: string }): StandingPage {
  return { title: page.title, ...(page.lead === '' ? {} : { lead: page.lead }), sections: [], body: page.body, hero: true }
}
