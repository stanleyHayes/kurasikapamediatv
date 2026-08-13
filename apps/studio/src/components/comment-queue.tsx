'use client'

import { useState, useTransition } from 'react'
import { callAction } from '@kurasikapa/web-kit/actions/call'
import { moderateCommentAction } from '../actions/studio-actions'
import type { CommentView } from '@kurasikapa/web-kit/read-model/comment-view'

export function CommentQueue({ items }: { items: readonly CommentView[] }): React.ReactElement {
  if (items.length === 0) {
    return <p className="text-on-surface-variant">Nothing is waiting for moderation.</p>
  }

  return (
    <ul className="border-outline-variant/50 bg-surface-container-low divide-outline-variant/40 divide-y overflow-hidden rounded-xl border">
      {items.map((item) => (
        <QueueRow key={item.id} item={item} />
      ))}
    </ul>
  )
}

function QueueRow({ item }: { item: CommentView }): React.ReactElement | null {
  const row = useModeration(item.id)
  if (row.gone) return null

  return (
    <li className="px-6 py-4">
      <p className="text-on-surface-variant text-xs">
        On {item.articleId} · {item.createdAt.slice(0, 16).replace('T', ' ')}
      </p>
      <p className="text-on-surface mt-2 whitespace-pre-wrap">{item.body}</p>
      <div className="mt-3 flex gap-2">
        <DecideButton
          label="Approve"
          disabled={row.pending}
          onClick={() => {
            row.decide('approve')
          }}
        />
        <DecideButton
          label="Reject"
          disabled={row.pending}
          onClick={() => {
            row.decide('reject')
          }}
        />
      </div>
      {row.error !== null && (
        <p role="status" className="text-error mt-2 text-sm">
          {row.error}
        </p>
      )}
    </li>
  )
}

function DecideButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled: boolean
  onClick: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="border-outline-variant text-label-bold rounded border px-3 py-1 uppercase disabled:opacity-60"
    >
      {label}
    </button>
  )
}

function useModeration(commentId: string): {
  readonly gone: boolean
  readonly error: string | null
  readonly pending: boolean
  readonly decide: (decision: 'approve' | 'reject') => void
} {
  const [gone, setGone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return {
    gone,
    error,
    pending,
    decide: (decision) => {
      setError(null)
      startTransition(async () => {
        const result = await callAction(() => moderateCommentAction({ commentId, decision }))
        if (!result.ok) {
          setError(result.error.message)
          return
        }
        setGone(true)
      })
    },
  }
}
