import { NotPermitted } from '@kurasikapa/domain'
import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { CommentQueue } from '@/components/comment-queue'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'
import { toCommentView } from '@kurasikapa/web-kit/read-model/comment-view'

export default async function CommentsQueuePage({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  const actor = await requireActor()
  const page = await container()
    .listPendingComments.execute({ actor })
    .catch((error: unknown) => {
      if (error instanceof NotPermitted) redirect(`/${locale}`)
      throw error
    })

  return (
    <div className="space-y-6 pb-20">
      <p className="text-on-surface-variant text-sm">
        Oldest first. Nothing reaches the article until you approve it.
      </p>
      <CommentQueue items={page.items.map(toCommentView)} />
    </div>
  )
}
