import type { DraftView } from '@kurasikapa/web-kit/read-model/studio-view'
import { DraftRow } from './draft-row'
import { StudioEmptyState } from './empty-state'
import { CollectionView } from './collection-view'

/**
 * Shared by the drafts view and the review queue. The two differ in what they
 * fetch and who may see it, not in how a list of articles looks.
 */
export function DraftList({
  drafts,
  empty,
  caption,
}: {
  drafts: readonly DraftView[]
  empty: string
  caption?: string
}): React.ReactElement {
  if (drafts.length === 0) {
    return <StudioEmptyState eyebrow="Queue clear" icon="✓" title={empty} description="The editorial desk is caught up. New submissions will appear here in oldest-first order when a journalist sends work for review." action={{ href: '/', label: 'Return to editorial' }} />
  }

  return (
    <>
      {caption !== undefined && (
        <p className="text-on-surface-variant mb-[var(--space-sm)] text-sm">{caption}</p>
      )}
      <CollectionView noun="stories" filters={[...new Set(drafts.map((draft) => draft.status))]} entries={drafts.map((draft) => ({ id: draft.id, search: `${draft.title} ${draft.locale} ${draft.status}`, filter: draft.status, content: <DraftRow draft={draft} /> }))} />
    </>
  )
}
