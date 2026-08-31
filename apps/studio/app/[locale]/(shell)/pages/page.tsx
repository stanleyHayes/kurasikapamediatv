import { setRequestLocale } from 'next-intl/server'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'
import { SitePageEditor } from '@/components/site-page-editor'
import { decodeSitePageEntries } from '@kurasikapa/web-kit/read-model/site-page-entries'

export default async function PagesPage({ params }: { params: Promise<{ locale: string }> }): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)
  const actor = await requireActor()
  if (!actor.can('article:publish')) return <p className="text-error">You do not have permission to manage public pages.</p>
  const pages = (await Promise.all(['en', 'fr'].map((value) => container().sitePages.list(value)))).flat().map((page) => { const props = page.snapshot(); return { key: props.key, locale: props.locale, entries: decodeSitePageEntries(props.body) } })
  return <div className="space-y-6 pb-20"><p className="max-w-3xl text-sm leading-relaxed text-on-surface-variant">The approved introductions and guidance on Careers, Help and FAQ stay with the website. Add only the changing records readers need: open roles, help articles and new answers. English and French publish independently.</p><SitePageEditor pages={pages} /></div>
}
