'use client'

import { useState, useTransition } from 'react'
import { callAction } from '@kurasikapa/web-kit/actions/call'
import { toggleSavedAction } from '../actions/reader-actions'

/**
 * Optimistic in appearance, honest in fact.
 *
 * The label flips immediately so the tap feels instant, but a failure puts it
 * back and says why. A button that stays "Saved" after a failed save is a lie
 * the reader only discovers when the article is missing from their list.
 */
export function SaveButton({
  articleId,
  initiallySaved,
}: {
  articleId: string
  initiallySaved: boolean
}): React.ReactElement {
  const [saved, setSaved] = useState(initiallySaved)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const toggle = (): void => {
    const was = saved
    setSaved(!was)
    setError(null)

    startTransition(async () => {
      const result = await callAction(() => toggleSavedAction({ articleId }, was))

      if (result.ok) {
        setSaved(result.data.saved)
        return
      }

      setSaved(was)
      setError(
        result.error.code === 'not_signed_in' ? 'Sign in to save articles.' : result.error.message,
      )
    })
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        className="min-w-32 border border-outline-variant border-l-4 border-l-primary bg-surface-container-lowest px-4 py-3 text-left text-sm font-bold text-on-surface transition-colors hover:bg-primary hover:text-on-primary disabled:opacity-60"
      >
        <span aria-hidden className="mr-2">{saved ? '✓' : '+'}</span>{saved ? 'Saved' : 'Save story'}
      </button>

      {error !== null && (
        <p role="status" className="text-error mt-1 text-sm">
          {error}
        </p>
      )}
    </div>
  )
}
