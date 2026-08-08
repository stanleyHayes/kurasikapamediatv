import { setRequestLocale } from 'next-intl/server'
import { DraftList } from '@/components/studio/draft-list'
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

  return (
    <DraftList
      drafts={page.items.map(toDraftView).sort(byWorkflowPriority)}
      empty="Nothing here yet. Your drafts and submissions will appear in this list."
    />
  )
}
