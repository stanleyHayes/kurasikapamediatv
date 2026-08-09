'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { signIn } from '../../lib/auth-client'
import { SocialButtons } from './social-buttons'

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

  const submit = async (form: FormData): Promise<void> => {
    setError(null)

    // Deliberately one message for every failure — a rejected password, an
    // unknown address, or a thrown network error. Distinguishing them would
    // confirm which addresses are registered to anyone who asks.
    //
    // try/catch as well as the error field: the client rejects on some
    // failures rather than resolving with one, and a sign-in form that shows
    // nothing at all is the worst outcome of the three.
    try {
      const result = await signIn.email({
        email: text(form, 'email'),
        password: text(form, 'password'),
      })

      if (result.error) {
        setError(FAILED)
        return
      }
    } catch {
      setError(FAILED)
      return
    }

    // A full load, not router.push.
    //
    // Sign-in lives in the public (site) group and the studio is its own
    // full-screen shell. Route groups are invisible in the URL, so a
    // client-side navigation across that boundary left the reader's chrome
    // mounted over the admin surface — the footer stayed on screen, which an
    // E2E assertion caught. Crossing between route-group roots is a full page
    // load by design; making it explicit is the fix.
    //
    // The locale prefix is added by hand here because next-intl's router,
    // which normally supplies it, is exactly what is being bypassed.
    window.location.assign(`/${locale}${props.redirectTo}`)
  }

  return (
    <div className="flex max-w-md flex-col gap-[var(--spacing-md)]">
      <form action={submit} className="flex flex-col gap-[var(--spacing-sm)]">
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field label="Password" name="password" type="password" autoComplete="current-password" />

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

/**
 * FormData.get returns `string | File | null`. A File where a password should
 * be is a malformed submission, not something to stringify into
 * "[object Object]" and send to the auth endpoint.
 */
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
