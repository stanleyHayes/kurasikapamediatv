'use client'

import { useTransition } from 'react'
import { signOutAction } from '../actions/session'

/**
 * Sign out of the studio.
 *
 * Calls a server action rather than the browser auth client — the studio has
 * no `/api/auth` surface of its own, deliberately. See actions/session.ts.
 *
 * The action redirects, so there is no success path to render: `isPending`
 * stays true until the navigation replaces the page. That is why the label
 * changes rather than the button merely disabling — a dead button with no
 * feedback is how the first version of this read.
 */
export function SignOutButton(): React.ReactElement {
  const [pending, start] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        start(() => void signOutAction())
      }}
      className="text-label-bold text-on-surface-variant hover:text-primary uppercase transition-colors disabled:opacity-60"
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
