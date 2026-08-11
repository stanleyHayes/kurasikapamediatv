'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { authClient } from '../../lib/auth-client'

const FIELD =
  'border-outline-variant focus:border-secondary bg-surface-container-lowest text-on-surface rounded border px-3 py-2 outline-none transition-colors'

/**
 * Completes a sign-in that stopped for TOTP. A full load after success
 * crosses the public/studio route-group boundary — same reason as SignInForm.
 */
export function TwoFactorForm(): React.ReactElement {
  const locale = useLocale()
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

    window.location.assign(`/${locale}/studio`)
  }

  return (
    <form action={submit} className="flex max-w-md flex-col gap-[var(--spacing-sm)]">
      <label className="flex flex-col gap-2">
        <span className="text-label-bold text-on-surface-variant uppercase">Authenticator code</span>
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
        className="bg-primary text-on-primary text-label-bold mt-2 rounded px-4 py-2 uppercase"
      >
        Verify
      </button>
    </form>
  )
}
