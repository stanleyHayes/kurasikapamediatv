import type { SitePage, SitePageKey } from '@kurasikapa/domain'

export interface SitePageRepository {
  find(key: SitePageKey, locale: string): Promise<SitePage | null>
  list(locale: string): Promise<readonly SitePage[]>
  save(page: SitePage): Promise<void>
}
