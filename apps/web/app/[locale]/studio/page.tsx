import { setRequestLocale } from 'next-intl/server'
import { DraftRow } from '@/components/studio/draft-row'
import { requireActor } from '@/composition/actor'
import { container } from '@/composition/container'
import { byWorkflowPriority, toDraftView } from '@/read-model/studio-view'

export default async function StudioPage({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  // Never cached. A CMS list showing an editor stale workflow state is worse
  // than a slower list — they would act on it.
  const actor = await requireActor()
  const page = await container().listAuthoredArticles.execute({ actor })
  const drafts = page.items.map(toDraftView).sort(byWorkflowPriority)

  if (drafts.length === 0) {
    return (
      <p className="text-on-surface-variant py-[var(--spacing-lg)] text-[length:var(--text-body-lg)]">
        Nothing here yet. Your drafts and submissions will appear in this list.
      </p>
    )
  }

  return (
    <ul>
      {drafts.map((draft) => (
        <DraftRow key={draft.id} draft={draft} />
      ))}
    </ul>
  )
}
