import type { ArticleId } from '@kurasikapa/domain'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Editor } from '@/components/studio/editor'
import { StatusBadge } from '@/components/studio/status-badge'
import { requireActor } from '@/composition/actor'
import { container } from '@/composition/container'
import { ArticleNotFound } from '@kurasikapa/application'

interface Params {
  params: Promise<{ locale: string; id: string }>
}

/** `id` is request data — awaited inside the boundary, never above it. */
export default function EditorPage({ params }: Params): React.ReactElement {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditorBody params={params} />
    </Suspense>
  )
}

/** Editing is refused once an editor has judged the text. See Article.retitle. */
const EDITABLE: readonly string[] = ['draft', 'unpublished']

async function EditorBody({ params }: Params): Promise<React.ReactElement> {
  const { locale, id } = await params
  setRequestLocale(locale)

  const actor = await requireActor()

  const draft = await container()
    .getDraft.execute({ actor, articleId: id as ArticleId })
    .catch((error: unknown) => {
      // A draft the actor may not read is indistinguishable from one that does
      // not exist. Anything else is a bug and reaches the error boundary.
      if (error instanceof ArticleNotFound) notFound()
      throw error
    })

  const status = draft.article.status

  return (
    <>
      <div className="mb-[var(--spacing-md)] flex items-center gap-3">
        <StatusBadge status={status} />
        <span className="text-on-surface-variant text-label-bold uppercase">
          {draft.article.locale}
        </span>
      </div>

      <Editor
        articleId={draft.article.id}
        initialTitle={draft.article.snapshot().title}
        initialBody={draft.latest?.body ?? ''}
        status={status}
        editable={EDITABLE.includes(status)}
        locale={draft.article.locale}
      />
    </>
  )
}

function EditorSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-[var(--spacing-md)]" aria-hidden>
      <div className="bg-surface-container h-10 rounded" />
      <div className="bg-surface-container h-96 rounded" />
    </div>
  )
}
