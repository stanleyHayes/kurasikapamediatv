import { setRequestLocale } from 'next-intl/server'
import { type Metric, MetricCards } from '@/components/metric-cards'
import { PipelineItem } from '@/components/pipeline-item'
import { AiRail } from '@/components/ai-rail'
import { DashboardActions } from '@/components/dashboard-actions'
import { StudioEmptyState } from '@/components/empty-state'
import { loadAuthoredPipeline } from '@kurasikapa/web-kit/bff/load-studio'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'
import { type DraftView, byWorkflowPriority, toDraftView } from '@kurasikapa/web-kit/read-model/studio-view'
import { CollectionView } from '@/components/collection-view'

/**
 * The design's figures are Total Articles, AI Tokens Used and Alerts. Only the
 * first can be sourced — there is no token accounting and no alerting until R5 —
 * and a dashboard is the one screen where an invented number does real damage,
 * because an editor acts on it. These three are all derived from the list below.
 */
const metricsFor = (drafts: readonly DraftView[]): readonly Metric[] => [
  { label: 'Your articles', value: drafts.length, icon: '▤' },
  {
    label: 'Awaiting review',
    value: drafts.filter((d) => d.status === 'in_review').length,
    icon: '◷',
    emphasis: true,
  },
  { label: 'Live', value: drafts.filter((d) => d.status === 'published').length, icon: '◉' },
]

export default async function StudioPage({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  // Never cached. A CMS showing an editor stale workflow state is worse than a
  // slower one — they would act on it.
  const actor = await requireActor()
  const drafts = (
    await loadAuthoredPipeline(actor, async () => {
      const page = await container().listAuthoredArticles.execute({ actor })
      return page.items.map(({ article, excerpt }) => toDraftView(article, excerpt))
    })
  ).slice().sort(byWorkflowPriority)

  // Not cached, so reading the clock here is legal — this render IS the
  // request. The public listings differ because they are prerendered.
  const now = new Date().toISOString()

  return (
    <div className="space-y-8 pb-20">
      <MetricCards metrics={metricsFor(drafts)} />

      <DashboardActions />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <section className="space-y-6 lg:col-span-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-on-surface text-xl font-semibold">Active Pipeline</h2>
          </div>

          {drafts.length === 0 ? (
            <StudioEmptyState eyebrow="Pipeline clear" icon="✎" title="No stories on your desk." description="Your drafts, submissions and scheduled reports will appear here as a live production ledger. While the desk is clear, check the review queue or monitor incoming sources." action={{ href: '/review', label: 'Open review desk' }} secondaryAction={{ href: '/rss', label: 'Check sources' }} />
          ) : (
            <CollectionView noun="stories" filters={[...new Set(drafts.map((draft) => draft.status))]} entries={drafts.map((draft) => ({ id: draft.id, search: `${draft.title} ${draft.excerpt ?? ''} ${draft.locale} ${draft.status}`, filter: draft.status, content: <PipelineItem draft={draft} now={now} /> }))} />
          )}
        </section>

        <section className="lg:col-span-4">
          <AiRail />
        </section>
      </div>
    </div>
  )
}
