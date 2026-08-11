import { setRequestLocale } from 'next-intl/server'
import { type Metric, MetricCards } from '@/components/studio/metric-cards'
import { PipelineItem } from '@/components/studio/pipeline-item'
import { AiRail } from '@/components/studio/ai-rail'
import { loadAuthoredPipeline } from '@/bff/load-studio'
import { requireActor } from '@/composition/actor'
import { container } from '@/composition/container'
import { type DraftView, byWorkflowPriority, toDraftView } from '@/read-model/studio-view'

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

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <section className="space-y-6 lg:col-span-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-on-surface text-xl font-semibold">Active Pipeline</h2>
          </div>

          {drafts.length === 0 ? (
            <p className="text-on-surface-variant">
              Nothing here yet. Your drafts and submissions will appear in this list.
            </p>
          ) : (
            <ul className="space-y-3">
              {drafts.map((draft) => (
                <PipelineItem key={draft.id} draft={draft} now={now} />
              ))}
            </ul>
          )}
        </section>

        <section className="lg:col-span-4">
          <AiRail />
        </section>
      </div>
    </div>
  )
}
