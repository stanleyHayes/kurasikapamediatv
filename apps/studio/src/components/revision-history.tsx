'use client'

import { useState, useTransition } from 'react'
import { callAction } from '@kurasikapa/web-kit/actions/call'
import type { RevisionView } from '@kurasikapa/web-kit/read-model/studio-view'
import { restoreRevisionAction } from '../actions/studio-actions'

/**
 * An article's history, newest first.
 *
 * This data has been written since R1 and never once shown. Append-only
 * storage nobody can read is a promise made to an auditor and kept from the
 * newsroom — the whole reason to keep every version is that someone can go
 * back and look.
 *
 * Restoring writes the old text FORWARD as a new revision rather than
 * rewinding, so the list only ever grows. The current version is the one at
 * the top; there is deliberately no way to delete an entry from here, because
 * there is no way to delete one at all.
 */
interface Restore {
  readonly error: string | null
  readonly restoring: string | null
  readonly pending: boolean
  readonly restore: (revisionId: string) => void
}

function useRestore(articleId: string): Restore {
  const [error, setError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const restore = (revisionId: string): void => {
    setError(null)
    setRestoring(revisionId)

    startTransition(async () => {
      const result = await callAction(() => restoreRevisionAction({ articleId, revisionId }))

      if (!result.ok) {
        setError(result.error.message)
        setRestoring(null)
      }
      // On success the page re-renders with the new revision at the top, so
      // there is nothing to set here.
    })
  }

  return { error, restoring, pending, restore }
}

export function RevisionHistory({
  articleId,
  revisions,
  locale,
  editable,
}: {
  articleId: string
  revisions: readonly RevisionView[]
  locale: string
  editable: boolean
}): React.ReactElement {
  const { error, restoring, pending, restore } = useRestore(articleId)

  return (
    <section className="border-outline-variant bg-surface-container-low mt-6 border-t-4 border-t-secondary p-5">
      <HistoryHeading count={revisions.length} />

      <ol className="flex flex-col gap-3">
        {revisions.map((revision, index) => (
          <RevisionRow
            key={revision.id}
            revision={revision}
            locale={locale}
            isCurrent={index === 0}
            canRestore={editable && index > 0}
            restoring={restoring === revision.id && pending}
            disabled={pending}
            onRestore={() => {
              restore(revision.id)
            }}
          />
        ))}
      </ol>

      {error !== null && (
        <p role="alert" className="text-error mt-3 text-sm">
          {error}
        </p>
      )}
    </section>
  )
}

function HistoryHeading({ count }: { count: number }): React.ReactElement {
  return (
    <>
      <h3 className="font-display text-on-surface mb-1 text-lg font-semibold">History</h3>
      <p className="text-on-surface-variant mb-4 text-sm">
        {count} {count === 1 ? 'version' : 'versions'}. Restoring keeps every step — it writes the
        old text forward rather than erasing what came after.
      </p>
    </>
  )
}

function RevisionRow({
  revision,
  locale,
  isCurrent,
  canRestore,
  restoring,
  disabled,
  onRestore,
}: {
  revision: RevisionView
  locale: string
  isCurrent: boolean
  canRestore: boolean
  restoring: boolean
  disabled: boolean
  onRestore: () => void
}): React.ReactElement {
  return (
    <li className="border-outline-variant/40 border-b pb-3 last:border-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-label-bold text-on-surface uppercase">
          v{revision.seq}
          {isCurrent && <span className="text-secondary"> · current</span>}
        </span>

        <time dateTime={revision.createdAt} className="text-on-surface-variant text-sm">
          {new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC',
          }).format(new Date(revision.createdAt))}
        </time>
      </div>

      <p className="text-on-surface-variant mt-1 line-clamp-2 text-sm">{revision.excerpt}</p>

      {canRestore && (
        <button
          type="button"
          onClick={onRestore}
          disabled={disabled}
          className="text-label-bold text-secondary mt-2 uppercase underline-offset-4 hover:underline disabled:opacity-50"
        >
          {restoring ? 'Restoring…' : 'Restore this version'}
        </button>
      )}
    </li>
  )
}
