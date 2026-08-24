'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { register } from '../../lib/auth-client'
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
  'h-13 w-full border-outline-variant bg-surface-container-lowest text-on-surface rounded-xl border px-4 outline-none transition-colors'

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
    <div className="flex w-full flex-col gap-6">
      <form action={submit} className="flex w-full flex-col gap-5">
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
          className="bg-primary text-on-primary hover:bg-on-primary-container mt-2 h-13 w-full rounded-xl px-5 text-sm font-bold transition-colors"
        >
          Create account
        </button>
      </form>
      <SocialButtons providers={props.providers} callbackURL={props.callbackURL} />
    </div>
  )
}

/**
 * `name` and the captcha are accepted and not sent.
 *
 * `RegisterUser` takes an email and a password; a display name belongs to the
 * profile, which is a separate record with its own screen. Dropping it here is
 * visible rather than hidden — the field stays on the form and the next step
 * is to persist it — where quietly passing it to a route that ignores it would
 * look like it worked.
 */
async function attemptEmailSignUp(
  _name: string,
  email: string,
  password: string,
  _captcha: string | null,
): Promise<boolean> {
  return register(email, password)
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
    <label className="flex w-full flex-col gap-2">
      <span className="text-sm font-semibold text-on-surface">{props.label}</span>
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
