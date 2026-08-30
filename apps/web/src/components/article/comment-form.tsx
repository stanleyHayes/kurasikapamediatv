'use client'

import { MAX_COMMENT_BODY } from '@kurasikapa/domain'
import { useState, useTransition } from 'react'
import { callAction } from '@kurasikapa/web-kit/actions/call'
import { postCommentAction } from '../../actions/reader-actions'

export function CommentForm({ articleId }: { articleId: string }): React.ReactElement {
  const composer = useComposer(articleId)

  return (
    <form
      className="mt-7 border-t-4 border-secondary bg-surface-container-low p-5 md:p-7"
      onSubmit={(event) => {
        event.preventDefault()
        composer.submit()
      }}
    >
      <label className="block">
        <span className="font-display text-xl font-semibold text-on-surface">Add your perspective</span>
        <span className="mt-1 block text-sm text-on-surface-variant">Be specific, respectful and relevant to the reporting.</span>
        <textarea
          value={composer.body}
          onChange={(event) => {
            composer.setBody(event.target.value)
          }}
          maxLength={MAX_COMMENT_BODY}
          rows={4}
          placeholder="What would you add to this story?"
          className="border-outline-variant bg-surface mt-4 w-full border px-4 py-4 leading-relaxed outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </label>
      <button
        type="submit"
        disabled={composer.pending || composer.body.trim() === ''}
        className="bg-primary text-on-primary hover:bg-on-primary-container mt-4 px-6 py-3 text-sm font-bold transition-colors disabled:opacity-60"
      >
        {composer.pending ? 'Sending…' : 'Submit for review'}
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
