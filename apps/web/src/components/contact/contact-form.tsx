'use client'

import { useState, useTransition } from 'react'
import { callAction } from '../../actions/call'
import { submitContactMessageAction } from '../../actions/contact-actions'
import { contactCopy } from './contact-copy'

export function ContactForm(): React.ReactElement {
  const form = useContact()

  return (
    <form
      className="mt-8 max-w-md space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        form.submit()
      }}
    >
      <ContactFields form={form} />
      <button
        type="submit"
        disabled={form.pending || !form.ready}
        className="text-label-bold bg-secondary-container text-on-secondary-container rounded px-4 py-2 uppercase disabled:opacity-60"
      >
        {form.pending ? 'Sending…' : 'Send message'}
      </button>
      <FormStatus error={form.error} notice={form.notice} />
    </form>
  )
}

function ContactFields({
  form,
}: {
  form: ReturnType<typeof useContact>
}): React.ReactElement {
  return (
    <>
      <Field label="Name" type="text" maxLength={120} value={form.name} onChange={form.setName} />
      <Field
        label="Email"
        type="email"
        maxLength={254}
        value={form.email}
        onChange={form.setEmail}
      />
      <label className="block">
        <span className="text-label-bold text-on-surface-variant text-[10px] uppercase">
          Message
        </span>
        <textarea
          required
          maxLength={4000}
          rows={6}
          value={form.message}
          onChange={(event) => {
            form.setMessage(event.target.value)
          }}
          className="border-outline-variant bg-surface mt-2 w-full rounded border px-3 py-2"
        />
      </label>
    </>
  )
}

function Field({
  label,
  type,
  maxLength,
  value,
  onChange,
}: {
  label: string
  type: 'text' | 'email'
  maxLength: number
  value: string
  onChange: (value: string) => void
}): React.ReactElement {
  return (
    <label className="block">
      <span className="text-label-bold text-on-surface-variant text-[10px] uppercase">
        {label}
      </span>
      <input
        type={type}
        required
        maxLength={maxLength}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        className="border-outline-variant bg-surface mt-2 w-full rounded border px-3 py-2"
      />
    </label>
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

function useContact(): {
  readonly name: string
  readonly setName: (value: string) => void
  readonly email: string
  readonly setEmail: (value: string) => void
  readonly message: string
  readonly setMessage: (value: string) => void
  readonly error: string | null
  readonly notice: string | null
  readonly pending: boolean
  readonly ready: boolean
  readonly submit: () => void
} {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return {
    name,
    setName,
    email,
    setEmail,
    message,
    setMessage,
    error,
    notice,
    pending,
    ready: name.trim() !== '' && email.trim() !== '' && message.trim() !== '',
    submit: () => {
      setError(null)
      startTransition(async () => {
        const result = await callAction(() =>
          submitContactMessageAction({ name, email, message }),
        )
        if (!result.ok) {
          setError(contactCopy(result.error.code, result.error.message))
          return
        }
        setName('')
        setEmail('')
        setMessage('')
        setNotice('Message sent. The newsroom will reply by email.')
      })
    },
  }
}
