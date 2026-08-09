import type { ArticleId } from '@kurasikapa/domain'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Editor } from '@/components/studio/editor'
import type { ArticleStatus, Revision } from '@kurasikapa/domain'
import { excerptFrom } from '@kurasikapa/application'
import { RevisionHistory, type RevisionView } from '@/components/studio/revision-history'
import { TranslatePanel } from '@/components/studio/translate-panel'
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
const toRevisionView = (revision: Revision): RevisionView => ({
  id: revision.id,
  seq: revision.seq,
  title: revision.title,
  createdAt: revision.createdAt.toISOString(),
  excerpt: excerptFrom(revision.body, 160),
})

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
  const props = draft.article.snapshot()
  const body = draft.latest?.body ?? ''
  const editable = EDITABLE.includes(status)

  const history = await container().listRevisions.execute({
    actor,
    articleId: draft.article.id,
  })

  const revisions = history.map(toRevisionView)

  return (
    <>
      <div className="mb-[var(--spacing-md)] flex items-center gap-3">
        <StatusBadge status={status} />
        <span className="text-on-surface-variant text-label-bold uppercase">
          {draft.article.locale}
        </span>
      </div>

      <EditorWorkspace
        articleId={draft.article.id}
        title={props.title}
        body={body}
        status={status}
        editable={editable}
        articleLocale={draft.article.locale}
        familyId={props.familyId}
        categoryId={props.categoryId}
        revisions={revisions}
        locale={locale}
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

interface WorkspaceProps {
  articleId: string
  title: string
  body: string
  status: ArticleStatus
  editable: boolean
  /** The article's own locale, which drives translation. */
  articleLocale: string
  familyId: string
  categoryId: string
  revisions: readonly RevisionView[]
  /** The UI locale, which drives date formatting. */
  locale: string
}

/** Editor on the left, the panels that act on it on the right. */
function EditorWorkspace(props: WorkspaceProps): React.ReactElement {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <Editor
          articleId={props.articleId}
          initialTitle={props.title}
          initialBody={props.body}
          status={props.status}
          editable={props.editable}
          locale={props.articleLocale}
        />
      </div>

      <aside className="lg:col-span-4">
        <TranslatePanel
          title={props.title}
          body={props.body}
          locale={props.articleLocale}
          familyId={props.familyId}
          categoryId={props.categoryId}
        />

        <RevisionHistory
          articleId={props.articleId}
          revisions={props.revisions}
          locale={props.locale}
          editable={props.editable}
        />
      </aside>
    </div>
  )
}
