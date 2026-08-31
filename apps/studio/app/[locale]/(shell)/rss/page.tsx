import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { RssSourceForm } from '@/components/rss-source-form'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'
import { StudioEmptyState } from '@/components/empty-state'

export default async function RssPage({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  const actor = await requireActor()
  if (!actor.can('article:publish')) redirect(`/${locale}`)

  const [sources, sections] = await Promise.all([
    container().rssSources.list(),
    container().listSections.execute({ locale }),
  ])

  const categories = sections.map((section) => ({
    id: section.id,
    name: section.nameIn(locale),
  }))

  return (
    <div className="space-y-8 pb-20">
      <p className="text-on-surface-variant text-sm">
        Inbound feeds become drafts. Nothing is published until an editor
        approves it — the same integrity rule as everything else we print.
      </p>
      <RssSourceForm locale={locale} categories={categories} />
      {sources.length === 0 ? <StudioEmptyState eyebrow="Source intake" icon="rss" title="No feeds are connected." description="Add a trusted RSS source above. New items arrive as drafts and still require editorial review before publication." compact /> : <ul className="space-y-2">
        {sources.map((source) => (
          <li key={source.id} className="text-on-surface text-sm">
            {source.url}
            <span className="text-on-surface-variant ml-2">{source.locale}</span>
          </li>
        ))}
      </ul>}
    </div>
  )
}
