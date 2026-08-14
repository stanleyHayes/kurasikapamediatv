'use client'

import { useState } from 'react'
import { authClient } from '../../lib/auth-client'

const FIELD =
  'h-14 w-full border-outline-variant bg-surface-container-lowest text-on-surface rounded-xl border px-4 text-center text-xl tracking-[0.35em] outline-none transition-colors'

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

    try {
      const result = await authClient.twoFactor.verifyTotp({ code })
      if (result.error) {
        setError('That code was not accepted.')
        return
      }
    } catch {
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
          required
          className={FIELD}
        />
      </label>

      {error !== null && (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="bg-primary text-on-primary hover:bg-on-primary-container mt-2 h-13 w-full rounded-xl px-5 text-sm font-bold transition-colors"
      >
        Verify
      </button>
    </form>
  )
}
