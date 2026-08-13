'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { signUp } from '../../lib/auth-client'
import { SocialButtons } from './social-buttons'
import { TurnstileField } from './turnstile-field'

export interface SignUpFormProps {
  /**
   * Locale-free path. next-intl adds the prefix.
   *
   * Same literal union as the sign-in form, for the same reason: a destination
   * taken from a query string would turn this form into an open redirect.
   */
  readonly redirectTo: '/studio'
  /** Absolute path for the OAuth round trip, which leaves the app. */
  readonly callbackURL: string
  readonly providers: readonly ('google' | 'facebook' | 'apple')[]
  readonly captchaSiteKey?: string | undefined
}

const FAILED = 'We could not create that account. The email may already be registered.'

const FIELD =
  'border-outline-variant focus:border-secondary bg-surface-container-lowest text-on-surface rounded border px-3 py-2 outline-none transition-colors'

/**
 * Reader self-registration. Mirrors the sign-in form: React 19 form action,
 * no controlled field state, and the same post-success destination — a fresh
 * account is signed in by Better Auth, so it lands where sign-in lands.
 *
 * `minLength` matches Better Auth's default minimum password length, so the
 * browser refuses early instead of round-tripping a guaranteed 400.
 */
export function SignUpForm(props: SignUpFormProps): React.ReactElement {
  const locale = useLocale()
  const [error, setError] = useState<string | null>(null)
  const [captcha, setCaptcha] = useState<string | null>(null)

  const submit = async (form: FormData): Promise<void> => {
    setError(null)
    const ok = await attemptEmailSignUp(
      text(form, 'name'),
      text(form, 'email'),
      text(form, 'password'),
      captcha,
    )
    if (!ok) {
      setError(FAILED)
      return
    }
    window.location.assign(`/${locale}${props.redirectTo}`)
  }

  return (
    <div className="flex max-w-md flex-col gap-[var(--spacing-md)]">
      <form action={submit} className="flex flex-col gap-[var(--spacing-sm)]">
        <Field label="Name" name="name" type="text" autoComplete="name" />
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
        />
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
          Create account
        </button>
      </form>
      <SocialButtons providers={props.providers} callbackURL={props.callbackURL} />
    </div>
  )
}

async function attemptEmailSignUp(
  name: string,
  email: string,
  password: string,
  captcha: string | null,
): Promise<boolean> {
  try {
    const result = await signUp.email({
      name,
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
  minLength?: number | undefined
}): React.ReactElement {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-label-bold text-on-surface-variant uppercase">{props.label}</span>
      <input
        type={props.type}
        name={props.name}
        autoComplete={props.autoComplete}
        required
        {...(props.minLength === undefined ? {} : { minLength: props.minLength })}
        className={FIELD}
      />
    </label>
  )
}
