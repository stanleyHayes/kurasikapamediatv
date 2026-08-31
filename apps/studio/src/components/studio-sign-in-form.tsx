'use client'

import { useState } from 'react'
import { FormSubmitButton } from '@kurasikapa/ui/form-submit-button'

interface Props {
  readonly destination: string
  readonly forgotPasswordUrl: string
  readonly sessionEndpoint: string
}

interface Payload {
  readonly secondFactor?: unknown
  readonly challengeToken?: unknown
}

const FIELD = 'h-full min-w-0 flex-1 border-0 bg-transparent px-1 text-on-surface outline-none placeholder:text-on-surface-variant/55'
const FAILED = 'Those details did not match an account.'

export function StudioSignInForm({ destination, forgotPasswordUrl, sessionEndpoint }: Props): React.ReactElement {
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
      {challenge === null ? <PasswordFields forgotPasswordUrl={forgotPasswordUrl} /> : <CodeField />}
      {error !== null && <p role="alert" className="text-error text-sm">{error}</p>}
      <FormSubmitButton pendingLabel={challenge === null ? 'Signing in' : 'Verifying'} className="bg-primary text-on-primary hover:bg-inverse-surface h-13 px-5 text-sm font-bold transition-[background-color,opacity,transform] active:translate-y-px disabled:cursor-wait disabled:opacity-65">
        {challenge === null ? 'Sign in to Studio' : 'Verify and continue'}
      </FormSubmitButton>
    </form>
  )
}

function PasswordFields({ forgotPasswordUrl }: { forgotPasswordUrl: string }): React.ReactElement {
  return <><Field label="Email" name="email" type="email" autoComplete="email" placeholder="you@kurasikapamediatv.com" icon="email" /><Field label="Password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" icon="lock" /><a href={forgotPasswordUrl} className="text-primary -mt-2 self-end text-sm font-bold underline decoration-primary/30 underline-offset-4 transition-colors hover:decoration-primary">Forgot password?</a></>
}

function CodeField(): React.ReactElement {
  return <Field label="Authenticator code" name="code" type="text" autoComplete="one-time-code" placeholder="000 000" icon="code" />
}

function Field(props: { label: string; name: string; type: string; autoComplete: string; placeholder: string; icon: 'email' | 'lock' | 'code' }): React.ReactElement {
  const [revealed, setRevealed] = useState(false)
  const password = props.type === 'password'
  return <label className="flex flex-col gap-2"><span className="text-sm font-semibold">{props.label}</span><span className="flex h-14 items-center border border-outline-variant bg-surface-container-lowest transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15"><FieldIcon name={props.icon} /><input {...props} type={password && revealed ? 'text' : props.type} required className={FIELD} />{password && <button type="button" aria-label={revealed ? 'Hide password' : 'Show password'} aria-pressed={revealed} onClick={() => { setRevealed((visible) => !visible) }} className="mr-2 grid size-10 place-items-center text-on-surface-variant outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"><EyeIcon crossed={revealed}/></button>}</span></label>
}

function FieldIcon({ name }: { name: 'email' | 'lock' | 'code' }): React.ReactElement {
  const path = name === 'email'
    ? <path d="m3 6 9 6 9-6M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z" />
    : name === 'lock'
      ? <path d="M7 10V7a5 5 0 0 1 10 0v3m-9 0h8a2 2 0 0 1 2 2v7H6v-7a2 2 0 0 1 2-2Z" />
      : <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h.01M11 9h.01M15 9h.01M7 13h.01M11 13h.01M15 13h.01"/></>
  return <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="ml-4 mr-3 size-5 shrink-0 text-primary">{path}</svg>
}

function EyeIcon({ crossed }: { crossed: boolean }): React.ReactElement {
  return <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>{crossed && <path d="m4 4 16 16"/>}</svg>
}

function text(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === 'string' ? value : ''
}
