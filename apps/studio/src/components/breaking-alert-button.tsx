'use client'

import { useState, useTransition } from 'react'
import { sendBreakingAlertAction } from '../actions/breaking-alert'
import { callAction } from '@kurasikapa/web-kit/actions/call'

/**
 * Editor-only blast to confirmed newsletter subscribers in this locale.
 * Publishing does not send this — the click is the ask.
 */
export function BreakingAlertButton({ articleId }: { articleId: string }): React.ReactElement {
  const [pending, start] = useTransition()
  const [note, setNote] = useState<string | null>(null)

  return (
    <div className="border-outline-variant/50 flex items-center gap-4 border-t pt-4">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          start(async () => {
            const result = await callAction(() => sendBreakingAlertAction({ articleId }))
            setNote(result.ok ? mailed(result.data.sent) : result.error.message)
          })
        }}
        className="bg-secondary-container text-on-secondary-container text-label-bold rounded px-4 py-2 uppercase disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Send breaking alert'}
      </button>
      {note !== null && <p className="text-on-surface-variant text-sm">{note}</p>}
    </div>
  )
}

function mailed(sent: number): string {
  if (sent === 0) return 'No confirmed subscribers for this locale.'
  return `Alert mailed to ${String(sent)}.`
}
