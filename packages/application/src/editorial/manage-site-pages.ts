import { requirePermission, SitePage, type Actor, type SitePageKey } from '@kurasikapa/domain'
import type { ClockPort } from '../ports/ambient'
import type { SitePageRepository } from '../ports/site-page-repository'
import type { UseCase } from '../ports/use-case'

export interface ManageSitePageInput { readonly actor: Actor; readonly key: SitePageKey; readonly locale: string; readonly title: string; readonly lead: string; readonly body: string }

export class ManageSitePages implements UseCase<ManageSitePageInput, SitePage> {
  constructor(private readonly deps: { readonly pages: SitePageRepository; readonly clock: ClockPort }) {}
  async execute(input: ManageSitePageInput): Promise<SitePage> {
    requirePermission(input.actor, 'article:publish')
    const page = SitePage.create({ key: input.key, locale: input.locale, title: input.title, lead: input.lead, body: input.body, updatedAt: this.deps.clock.now() })
    await this.deps.pages.save(page)
    return page
  }
}
