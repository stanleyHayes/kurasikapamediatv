import type { DraftView } from '@kurasikapa/web-kit/read-model/studio-view'
import { DraftRow } from './draft-row'

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
    return (
      <p className="text-on-surface-variant py-[var(--spacing-lg)] text-[length:var(--text-body-lg)]">
        {empty}
      </p>
    )
  }

  return (
    <>
      {caption !== undefined && (
        <p className="text-on-surface-variant mb-[var(--spacing-sm)] text-sm">{caption}</p>
      )}
      <ul>
        {drafts.map((draft) => (
          <DraftRow key={draft.id} draft={draft} />
        ))}
      </ul>
    </>
  )
}
