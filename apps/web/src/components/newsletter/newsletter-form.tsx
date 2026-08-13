'use client'

import { useState, useTransition } from 'react'
import { callAction } from '@kurasikapa/web-kit/actions/call'
import { subscribeNewsletterAction } from '../../actions/newsletter-actions'
import { newsletterCopy } from './newsletter-copy'

export function NewsletterForm({ locale }: { locale: string }): React.ReactElement {
  const form = useSubscribe(locale)

  return (
    <form
      className="mt-8 max-w-md space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        form.submit()
      }}
    >
      <EmailField value={form.email} onChange={form.setEmail} />
      <CadenceField value={form.cadence} onChange={form.setCadence} />
      <button
        type="submit"
        disabled={form.pending || form.email.trim() === ''}
        className="text-label-bold bg-secondary-container text-on-secondary-container rounded px-4 py-2 uppercase disabled:opacity-60"
      >
        {form.pending ? 'Sending…' : 'Subscribe'}
      </button>
      <FormStatus error={form.error} notice={form.notice} />
    </form>
  )
}

function EmailField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}): React.ReactElement {
  return (
    <label className="block">
      <span className="text-label-bold text-on-surface-variant text-[10px] uppercase">Email</span>
      <input
        type="email"
        required
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        className="border-outline-variant bg-surface mt-2 w-full rounded border px-3 py-2"
      />
    </label>
  )
}

function CadenceField({
  value,
  onChange,
}: {
  value: 'daily' | 'weekly'
  onChange: (value: 'daily' | 'weekly') => void
}): React.ReactElement {
  return (
    <fieldset className="space-y-2">
      <legend className="text-label-bold text-on-surface-variant text-[10px] uppercase">
        Cadence
      </legend>
      {(['daily', 'weekly'] as const).map((cadence) => (
        <label key={cadence} className="text-on-surface mr-4 text-sm">
          <input
            type="radio"
            name="cadence"
            checked={value === cadence}
            onChange={() => {
              onChange(cadence)
            }}
            className="mr-2"
          />
          {cadence === 'daily' ? 'Daily' : 'Weekly'}
        </label>
      ))}
    </fieldset>
  )
}

function FormStatus({
  error,
  notice,
}: {
  error: string | null
  notice: string | null
}): React.ReactElement | null {
  if (error !== null) {
    return (
      <p role="status" className="text-error text-sm">
        {error}
      </p>
    )
  }
  if (notice !== null) {
    return (
      <p role="status" className="text-on-surface-variant text-sm">
        {notice}
      </p>
    )
  }
  return null
}

function useSubscribe(locale: string): {
  readonly email: string
  readonly setEmail: (value: string) => void
  readonly cadence: 'daily' | 'weekly'
  readonly setCadence: (value: 'daily' | 'weekly') => void
  readonly error: string | null
  readonly notice: string | null
  readonly pending: boolean
  readonly submit: () => void
} {
  const [email, setEmail] = useState('')
  const [cadence, setCadence] = useState<'daily' | 'weekly'>('daily')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return {
    email,
    setEmail,
    cadence,
    setCadence,
    error,
    notice,
    pending,
    submit: () => {
      setError(null)
      startTransition(async () => {
        const result = await callAction(() =>
          subscribeNewsletterAction({ email, locales: [locale], cadence }),
        )
        if (!result.ok) {
          setError(newsletterCopy(result.error.code, result.error.message))
          return
        }
        setNotice('Check your inbox for a confirmation link. Nothing is mailed until you confirm.')
      })
    },
  }
}
