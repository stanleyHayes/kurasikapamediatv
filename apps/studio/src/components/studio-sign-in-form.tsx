'use client'

import { useState } from 'react'

interface Props {
  readonly destination: string
  readonly sessionEndpoint: string
}

interface Payload {
  readonly secondFactor?: unknown
  readonly challengeToken?: unknown
}

const FIELD = 'h-14 w-full border border-outline-variant bg-surface-container-lowest px-4 text-on-surface outline-none focus:border-primary'
const FAILED = 'Those details did not match an account.'

export function StudioSignInForm({ destination, sessionEndpoint }: Props): React.ReactElement {
  const [error, setError] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<string | null>(null)

  const submit = async (form: FormData): Promise<void> => {
    setError(null)
    const path = challenge === null ? sessionEndpoint : `${sessionEndpoint}/second-factor`
    const body = challenge === null
      ? { email: text(form, 'email'), password: text(form, 'password') }
      : { challengeToken: challenge, code: text(form, 'code') }
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })
      const payload = await response.json() as Payload
      if (!response.ok) {
        setError(challenge === null ? FAILED : 'That code was not accepted.')
        return
      }
      if (payload.secondFactor === true && typeof payload.challengeToken === 'string') {
        setChallenge(payload.challengeToken)
        return
      }
      window.location.assign(destination)
    } catch {
      setError('Studio sign-in is temporarily unavailable.')
    }
  }

  return (
    <form action={submit} className="flex flex-col gap-5">
      {challenge === null ? <PasswordFields /> : <CodeField />}
      {error !== null && <p role="alert" className="text-error text-sm">{error}</p>}
      <button type="submit" className="bg-primary text-on-primary h-13 px-5 text-sm font-bold">
        {challenge === null ? 'Sign in to Studio' : 'Verify and continue'}
      </button>
    </form>
  )
}

function PasswordFields(): React.ReactElement {
  return <><Field label="Email" name="email" type="email" autoComplete="email" /><Field label="Password" name="password" type="password" autoComplete="current-password" /></>
}

function CodeField(): React.ReactElement {
  return <Field label="Authenticator code" name="code" type="text" autoComplete="one-time-code" />
}

function Field(props: { label: string; name: string; type: string; autoComplete: string }): React.ReactElement {
  return <label className="flex flex-col gap-2"><span className="text-sm font-semibold">{props.label}</span><input {...props} required className={FIELD} /></label>
}

function text(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === 'string' ? value : ''
}
