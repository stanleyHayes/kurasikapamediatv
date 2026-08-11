'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { signIn } from '../../lib/auth-client'
import { SocialButtons } from './social-buttons'
import { TurnstileField } from './turnstile-field'

export interface SignInFormProps {
  /**
   * Locale-free path. next-intl adds the prefix.
   *
   * A literal union rather than a string: `typedRoutes` rejects an arbitrary
   * string, and more usefully, a destination taken from a query string would
   * turn this form into an open redirect.
   */
  readonly redirectTo: '/studio'
  /** Absolute path for the OAuth round trip, which leaves the app. */
  readonly callbackURL: string
  readonly providers: readonly ('google' | 'facebook' | 'apple')[]
  readonly captchaSiteKey?: string | undefined
}

const FAILED = 'Those details did not match an account.'

const FIELD =
  'border-outline-variant focus:border-secondary bg-surface-container-lowest text-on-surface rounded border px-3 py-2 outline-none transition-colors'

/**
 * Uses React 19's form action rather than an onSubmit handler: no controlled
 * state to keep in sync, and the fields still submit if hydration has not
 * finished — which is the difference between a slow connection and a broken
 * sign-in page.
 */
export function SignInForm(props: SignInFormProps): React.ReactElement {
  const locale = useLocale()
  const [error, setError] = useState<string | null>(null)
  const [captcha, setCaptcha] = useState<string | null>(null)

  const submit = async (form: FormData): Promise<void> => {
    setError(null)
    const ok = await attemptEmailSignIn(text(form, 'email'), text(form, 'password'), captcha)
    if (!ok) {
      setError(FAILED)
      return
    }
    window.location.assign(`/${locale}${props.redirectTo}`)
  }

  return (
    <div className="flex max-w-md flex-col gap-[var(--spacing-md)]">
      <form action={submit} className="flex flex-col gap-[var(--spacing-sm)]">
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field label="Password" name="password" type="password" autoComplete="current-password" />
        {props.captchaSiteKey !== undefined && (
          <TurnstileField siteKey={props.captchaSiteKey} onToken={setCaptcha} />
        )}
        {error !== null && (
          <p role="alert" className="text-error text-sm">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="bg-primary text-on-primary text-label-bold mt-2 rounded px-4 py-2 uppercase"
        >
          Sign in
        </button>
      </form>
      <SocialButtons providers={props.providers} callbackURL={props.callbackURL} />
    </div>
  )
}

async function attemptEmailSignIn(
  email: string,
  password: string,
  captcha: string | null,
): Promise<boolean> {
  try {
    const result = await signIn.email({
      email,
      password,
      ...(captcha === null ? {} : { fetchOptions: { headers: { 'x-captcha-response': captcha } } }),
    })
    return !('error' in result && result.error)
  } catch {
    return false
  }
}

function text(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === 'string' ? value : ''
}

function Field(props: {
  label: string
  name: string
  type: string
  autoComplete: string
}): React.ReactElement {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-label-bold text-on-surface-variant uppercase">{props.label}</span>
      <input
        type={props.type}
        name={props.name}
        autoComplete={props.autoComplete}
        required
        className={FIELD}
      />
    </label>
  )
}
