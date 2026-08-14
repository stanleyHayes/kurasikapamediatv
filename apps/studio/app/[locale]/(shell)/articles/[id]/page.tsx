import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { loadStudioDraft } from '@kurasikapa/web-kit/bff/load-studio'
import { BreakingAlertButton } from '@/components/breaking-alert-button'
import { EditorWorkspace } from '@/components/editor-workspace'
import { StatusBadge } from '@/components/status-badge'
import { TransitionControls } from '@/components/transition-controls'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
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

const EDITABLE: readonly string[] = ['draft', 'unpublished']

async function EditorBody({ params }: Params): Promise<React.ReactElement> {
  const { locale, id } = await params
  setRequestLocale(locale)

  const actor = await requireActor()
  const draft = await loadStudioDraft(actor, id).catch((error: unknown) => {
    if (error instanceof ArticleNotFound) notFound()
    throw error
  })

  return (
    <>
      <div className="mb-[var(--space-md)] flex items-center gap-3">
        <StatusBadge status={draft.status} />
        <span className="text-on-surface-variant text-label-bold uppercase">{draft.locale}</span>
      </div>

      {/*
        `owned` is derived, not loaded: the studio read model carries no
        authorId, and anyone on this page without `article:edit_any` got here
        through `assertReadableBy` — which only the author passes.
      */}
      <TransitionControls
        articleId={draft.id}
        status={draft.status}
        roles={actor.roles}
        owned={!actor.can('article:edit_any')}
        latestRevisionId={draft.revisions[0]?.id ?? null}
      />

      <EditorWorkspace
        articleId={draft.id}
        initialTitle={draft.title}
        initialBody={draft.body}
        status={draft.status}
        editable={EDITABLE.includes(draft.status)}
        articleLocale={draft.locale}
        familyId={draft.familyId}
        categoryId={draft.categoryId}
        revisions={draft.revisions}
        uiLocale={locale}
      />

      {draft.status === 'published' && <BreakingAlertButton articleId={draft.id} />}
    </>
  )
}

function EditorSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-[var(--space-md)]" aria-hidden>
      <div className="bg-surface-container h-10 rounded" />
      <div className="bg-surface-container h-96 rounded" />
    </div>
  )
}
