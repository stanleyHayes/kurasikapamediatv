'use client'

import { useState, useTransition } from 'react'
import { PASSWORD_RULES } from '@kurasikapa/domain'
import { changeStudioPasswordAction } from '../actions/account-actions'

const FIELD = 'h-13 w-full border border-outline-variant bg-surface-container-lowest px-4 text-on-surface outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-4 focus:ring-primary/15'
const DONE = 'Password updated. Every other session has been signed out.'
const MISMATCH = 'The two new-password entries do not match.'

/**
 * Confirmation is checked HERE and nowhere else, deliberately.
 *
 * It is not a domain rule — the platform has no opinion about whether a
 * password was typed twice — it is a guard against a typo locking an editor
 * out of the newsroom. Sending it to the server would put a UI affordance into
 * the use case; catching it before the request keeps the rule where it belongs
 * and saves a round trip.
 */
export function StudioPasswordForm(): React.ReactElement {
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [pending, start] = useTransition()

  const submit = (data: FormData): void => {
    const currentPassword = value(data, 'currentPassword')
    const newPassword = value(data, 'newPassword')

    if (newPassword !== value(data, 'confirmPassword')) {
      setMessage({ text: MISMATCH, ok: false })
      return
    }

    start(async () => {
      const result = await changeStudioPasswordAction({ currentPassword, newPassword })
      setMessage(result.ok ? { text: DONE, ok: true } : { text: result.error.message, ok: false })
    })
  }

  return <form action={submit} className="grid max-w-3xl gap-5 md:grid-cols-2">
    <Field label="Current password" name="currentPassword" autoComplete="current-password" className="md:col-span-2" />
    <Field label="New password" name="newPassword" autoComplete="new-password" minLength={PASSWORD_RULES.minLength} />
    <Field label="Confirm new password" name="confirmPassword" autoComplete="new-password" minLength={PASSWORD_RULES.minLength} />
    <p className="text-on-surface-variant md:col-span-2 text-xs">At least {PASSWORD_RULES.minLength} characters. Length is what resists guessing, so a memorable passphrase beats a short password with symbols in it. It may not contain your email name.</p>
    <div className="md:col-span-2">
      <button type="submit" disabled={pending} className="bg-primary text-on-primary hover:bg-inverse-surface h-13 px-6 text-sm font-bold transition-[background-color,opacity,transform] active:translate-y-px disabled:cursor-wait disabled:opacity-65">{pending ? 'Updating…' : 'Update password'}</button>
      {message !== null && <p role={message.ok ? 'status' : 'alert'} className={`mt-4 border-l-4 py-2 pl-3 text-sm ${message.ok ? 'border-primary text-on-surface' : 'border-error text-error'}`}>{message.text}</p>}
    </div>
  </form>
}

function Field({ label, name, autoComplete, minLength, className = '' }: { label: string; name: string; autoComplete: string; minLength?: number; className?: string }): React.ReactElement {
  const [revealed, setRevealed] = useState(false)
  return <label className={`flex flex-col gap-2 ${className}`}>
    <span className="text-sm font-semibold">{label}</span>
    <span className="relative flex items-center">
      <input name={name} type={revealed ? 'text' : 'password'} autoComplete={autoComplete} required {...(minLength === undefined ? {} : { minLength })} className={`${FIELD} pr-12`} />
      <button type="button" aria-label={revealed ? `Conceal ${label.toLowerCase()}` : `Reveal ${label.toLowerCase()}`} aria-pressed={revealed} onClick={() => { setRevealed((on) => !on) }} className="text-on-surface-variant hover:text-primary focus-visible:ring-primary absolute right-1 grid size-11 place-items-center outline-none transition-colors focus-visible:ring-2">
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>{revealed && <path d="m4 4 16 16"/>}</svg>
      </button>
    </span>
  </label>
}

function value(form: FormData, name: string): string {
  const raw = form.get(name)
  return typeof raw === 'string' ? raw : ''
}
