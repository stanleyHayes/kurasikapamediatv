'use client'

import { useState } from 'react'
import { completeSecondFactor, takeChallenge } from '../../lib/auth-client'
import { FormSubmitButton } from '@kurasikapa/ui/form-submit-button'

const FIELD =
  'h-14 w-full border-outline-variant bg-surface-container-lowest text-on-surface border px-4 text-center text-xl tracking-[0.35em] outline-none transition-colors'

/**
 * Completes a sign-in that stopped for TOTP.
 *
 * A full load after success, not a client navigation: the destination is the
 * studio, which is a separate deployment now and may be on another origin.
 * `destination` is server-supplied for the same reason SignInForm's is —
 * reading it from the query string would make this an open redirect.
 */
export function TwoFactorForm({ destination }: { destination: string }): React.ReactElement {
  const [error, setError] = useState<string | null>(null)

  const submit = async (form: FormData): Promise<void> => {
    setError(null)
    const code = form.get('code')
    if (typeof code !== 'string' || code === '') {
      setError('Enter the six-digit code from your authenticator.')
      return
    }

    // Consumed, not read: a challenge is single use, and leaving it in
    // storage after a failed attempt invites replaying it in another tab.
    const challenge = takeChallenge()
    if (challenge === null) {
      setError('That code was not accepted.')

      return
    }

    if (!(await completeSecondFactor(challenge, code))) {
      setError('That code was not accepted.')

      return
    }

    window.location.assign(destination)
  }

  return (
    <form action={submit} className="flex w-full flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-on-surface">Authenticator code</span>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000 000"
          required
          className={FIELD}
        />
      </label>

      {error !== null && (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      )}

      <FormSubmitButton pendingLabel="Verifying" className="bg-primary text-on-primary hover:bg-on-primary-container mt-2 h-13 w-full px-5 text-sm font-bold transition-[background-color,opacity,transform] active:translate-y-px disabled:cursor-wait disabled:opacity-65">
        Verify
      </FormSubmitButton>
    </form>
  )
}
