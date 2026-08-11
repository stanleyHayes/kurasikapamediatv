'use client'

import { useState, useTransition } from 'react'
import { callAction } from '../../actions/call'
import { unsubscribeNewsletterAction } from '../../actions/newsletter-actions'
import { newsletterCopy } from './newsletter-copy'

export function UnsubscribeForm(): React.ReactElement {
  const form = useLeave()

  return (
    <form
      className="mt-8 max-w-md space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        form.submit()
      }}
    >
      <label className="block">
        <span className="text-label-bold text-on-surface-variant text-[10px] uppercase">
          Email
        </span>
        <input
          type="email"
          required
          value={form.email}
          onChange={(event) => {
            form.setEmail(event.target.value)
          }}
          className="border-outline-variant bg-surface mt-2 w-full rounded border px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={form.pending || form.email.trim() === ''}
        className="text-label-bold border-outline-variant rounded border px-4 py-2 uppercase disabled:opacity-60"
      >
        {form.pending ? 'Working…' : 'Unsubscribe'}
      </button>
      {form.error !== null && (
        <p role="status" className="text-error text-sm">
          {form.error}
        </p>
      )}
      {form.notice !== null && (
        <p role="status" className="text-on-surface-variant text-sm">
          {form.notice}
        </p>
      )}
    </form>
  )
}

function useLeave(): {
  readonly email: string
  readonly setEmail: (value: string) => void
  readonly error: string | null
  readonly notice: string | null
  readonly pending: boolean
  readonly submit: () => void
} {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return {
    email,
    setEmail,
    error,
    notice,
    pending,
    submit: () => {
      setError(null)
      startTransition(async () => {
        const result = await callAction(() => unsubscribeNewsletterAction({ email }))
        if (!result.ok) {
          setError(newsletterCopy(result.error.code, result.error.message))
          return
        }
        setNotice('You have been removed from the briefing list.')
      })
    },
  }
}
