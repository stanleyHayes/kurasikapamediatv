'use client'

import { useState } from 'react'
import { rememberChallenge, signInWithPassword } from '../../lib/auth-client'
import { SocialButtons } from './social-buttons'
import { TurnstileField } from './turnstile-field'

export interface SignInFormProps {
  /**
   * Where a successful sign-in lands. An ABSOLUTE url, because the studio is
   * a separate deployment and may be on a different origin (ADR-0011).
   *
   * Still supplied by the server, never read from the query string — that is
   * what keeps this form from becoming an open redirect. It stopped being a
   * literal union when the destination stopped being a path this app owns.
   */
  readonly destination: string
  /** Where a second factor is collected. Absolute, for the same reason. */
  readonly twoFactorUrl: string
  /** Absolute URL for the OAuth round trip, which leaves the app. */
  readonly callbackURL: string
  readonly providers: readonly ('google' | 'facebook' | 'apple')[]
  readonly captchaSiteKey?: string | undefined
}

const FAILED = 'Those details did not match an account.'

const FIELD =
  'h-13 w-full border-outline-variant bg-surface-container-lowest text-on-surface rounded-xl border px-4 outline-none transition-colors placeholder:text-on-surface-variant/50'

/**
 * Uses React 19's form action rather than an onSubmit handler: no controlled
 * state to keep in sync, and the fields still submit if hydration has not
 * finished — which is the difference between a slow connection and a broken
 * sign-in page.
 */
export function SignInForm(props: SignInFormProps): React.ReactElement {
  const [error, setError] = useState<string | null>(null)
  const [captcha, setCaptcha] = useState<string | null>(null)

  const submit = async (form: FormData): Promise<void> => {
    setError(null)
    const result = await signInWithPassword(text(form, 'email'), text(form, 'password'), captcha)

    // Right password, second factor owed. The challenge is not a session — it
    // goes to the code page, which trades it for one.
    if (result.challengeToken !== undefined) {
      rememberChallenge(result.challengeToken)
      window.location.assign(props.twoFactorUrl)

      return
    }

    if (!result.ok) {
      setError(FAILED)

      return
    }

    window.location.assign(props.destination)
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <form action={submit} className="flex w-full flex-col gap-5">
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
          className="bg-primary text-on-primary hover:bg-on-primary-container mt-2 h-13 w-full rounded-xl px-5 text-sm font-bold transition-colors"
        >
          Sign in
        </button>
      </form>
      <SocialButtons providers={props.providers} callbackURL={props.callbackURL} />
    </div>
  )
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
    <label className="flex w-full flex-col gap-2">
      <span className="text-sm font-semibold text-on-surface">{props.label}</span>
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
