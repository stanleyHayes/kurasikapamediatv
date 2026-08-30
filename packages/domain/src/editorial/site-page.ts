export const SITE_PAGE_KEYS = ['about', 'team', 'contact', 'careers', 'faq', 'advertise', 'privacy', 'terms', 'cookies'] as const
export type SitePageKey = (typeof SITE_PAGE_KEYS)[number]

export interface SitePageProps { readonly id: string; readonly key: SitePageKey; readonly locale: string; readonly title: string; readonly lead: string; readonly body: string; readonly updatedAt: Date }
export type NewSitePage = Omit<SitePageProps, 'id'>

export class EmptyPageContent extends Error { constructor() { super('Site page title and body are required'); this.name = 'EmptyPageContent' } }

export class SitePage {
  private constructor(private readonly props: SitePageProps) {}

  static create(input: NewSitePage): SitePage {
    const title = input.title.trim()
    const body = input.body.trim()
    if (title === '' || body === '') throw new EmptyPageContent()
    return new SitePage({ ...input, id: `${input.key}:${input.locale}`, title, lead: input.lead.trim(), body })
  }

  static reconstitute(props: SitePageProps): SitePage { return new SitePage(props) }
  snapshot(): SitePageProps { return { ...this.props } }
}
