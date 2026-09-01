'use client'

import { useState, useTransition } from 'react'
import { callAction } from '@kurasikapa/web-kit/actions/call'
import { schedulePublicationAction } from '../actions/editorial'
import { useRouter } from '@kurasikapa/web-kit/i18n/navigation'
import { BrandedDateTime } from './branded-date-time'

/**
 * The only date picker in the studio, for the one transition that needs a
 * moment in time.
 *
 * Rendered by TransitionControls only when the domain allows scheduling at all
 * (status `approved`, `article:publish` held), so this component does not
 * re-ask that question. What it does own is the input itself: a datetime the
 * domain then judges against its injected clock — a moment in the past comes
 * back as `schedule_in_past`, which is why the error stays on screen rather
 * than being cleared by the refresh.
 */
export function ScheduleControl({
  articleId,
  onSuccess,
}: {
  articleId: string
  onSuccess: () => void
}): React.ReactElement {
  const [at, setAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  const schedule = (): void => {
    setError(null)

    start(async () => {
      // `datetime-local` carries no zone; `new Date` reads it as browser-local
      // and the serialised Date preserves the instant, which is all the domain
      // compares.
      const result = await callAction(() =>
        schedulePublicationAction({ articleId, at: new Date(at) }),
      )

      if (!result.ok) {
        setError(result.error.message)
        return
      }

      onSuccess()
      router.refresh()
    })
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <BrandedDateTime
        label="Publication date and time"
        value={at}
        disabled={pending}
        onChange={setAt}
      />

      <button
        type="button"
        disabled={pending || at === ''}
        onClick={schedule}
        className="bg-secondary-container text-on-secondary-container text-label-bold rounded px-4 py-2 uppercase disabled:opacity-50"
      >
        {pending ? 'Scheduling…' : 'Schedule'}
      </button>

      {error !== null && (
        <p role="alert" className="text-error basis-full text-sm">
          {error}
        </p>
      )}
    </span>
  )
}
