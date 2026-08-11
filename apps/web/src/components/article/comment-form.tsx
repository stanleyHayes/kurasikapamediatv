'use client'

import { MAX_COMMENT_BODY } from '@kurasikapa/domain'
import { useState, useTransition } from 'react'
import { callAction } from '../../actions/call'
import { postCommentAction } from '../../actions/side-actions'

export function CommentForm({ articleId }: { articleId: string }): React.ReactElement {
  const composer = useComposer(articleId)

  return (
    <form
      className="mt-6 space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        composer.submit()
      }}
    >
      <label className="block">
        <span className="text-label-bold text-on-surface-variant text-[10px] uppercase">
          Your comment
        </span>
        <textarea
          value={composer.body}
          onChange={(event) => {
            composer.setBody(event.target.value)
          }}
          maxLength={MAX_COMMENT_BODY}
          rows={4}
          className="border-outline-variant bg-surface mt-2 w-full rounded border px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={composer.pending || composer.body.trim() === ''}
        className="border-outline-variant text-label-bold hover:border-secondary rounded border px-3 py-1 uppercase disabled:opacity-60"
      >
        {composer.pending ? 'Sending…' : 'Comment'}
      </button>
      {composer.error !== null && (
        <p role="status" className="text-error text-sm">
          {composer.error}
        </p>
      )}
      {composer.notice !== null && (
        <p role="status" className="text-on-surface-variant text-sm">
          {composer.notice}
        </p>
      )}
    </form>
  )
}

function useComposer(articleId: string): {
  readonly body: string
  readonly setBody: (value: string) => void
  readonly error: string | null
  readonly notice: string | null
  readonly pending: boolean
  readonly submit: () => void
} {
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return {
    body,
    setBody,
    error,
    notice,
    pending,
    submit: () => {
      setError(null)
      startTransition(async () => {
        const result = await callAction(() => postCommentAction({ articleId, body }))
        if (!result.ok) {
          setError(
            result.error.code === 'not_signed_in'
              ? 'Sign in to leave a comment.'
              : result.error.message,
          )
          return
        }
        setBody('')
        setNotice('Submitted for review. It will appear once an editor approves it.')
      })
    },
  }
}
