import { NotPermitted } from '@kurasikapa/domain'
import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { DraftList } from '@/components/studio/draft-list'
import { loadReviewQueue } from '@/bff/load-studio'
import { requireActor } from '@/composition/actor'
import { container } from '@/composition/container'
import { toDraftView } from '@/read-model/studio-view'

export default async function ReviewQueuePage({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  const actor = await requireActor()

  const queue = await loadReviewQueue(actor, async () => {
    const page = await container().listAwaitingReview.execute({ actor })
    return page.items.map((article) => toDraftView(article, null))
  }).catch((error: unknown) => {
    // A journalist reaching this URL goes back to their own drafts rather
    // than seeing an error. The refusal already happened in the use case;
    // this only decides what they are shown.
    if (error instanceof NotPermitted) redirect(`/${locale}/studio`)
    throw error
  })

  return (
    <DraftList
      drafts={queue}
      empty="Nothing is waiting for review."
      caption={`Oldest first — ${String(queue.length)} awaiting a decision.`}
    />
  )
}
