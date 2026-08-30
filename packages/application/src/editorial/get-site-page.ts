import type { SitePage, SitePageKey } from '@kurasikapa/domain'
import type { SitePageRepository } from '../ports/site-page-repository'

export class GetSitePage {
  constructor(private readonly pages: SitePageRepository) {}
  async execute(input: { readonly key: SitePageKey; readonly locale: string }): Promise<SitePage | null> { return this.pages.find(input.key, input.locale) }
}
