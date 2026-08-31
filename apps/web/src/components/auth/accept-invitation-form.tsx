'use client'

import { callAction } from '@kurasikapa/web-kit/actions/call'
import { useState, useTransition } from 'react'
import { acceptInvitationAction } from '../../actions/invitations'
import { AuthField } from './auth-field'

export function AcceptInvitationForm({ token }: { token: string }): React.ReactElement {
  const [message, setMessage] = useState<string | null>(null)
  const [complete, setComplete] = useState(false)
  const [pending, startTransition] = useTransition()
  const submit = (form: FormData): void => {
    const password = text(form.get('password'))
    const confirm = text(form.get('confirm'))
    if (password !== confirm) { setMessage('Passwords do not match.'); return }
    startTransition(async () => {
      const result = await callAction(() => acceptInvitationAction({ token, password }))
      if (!result.ok) { setMessage(result.error.message); return }
      setComplete(true); setMessage(`Account ready for ${result.data.email}. You can now sign in to Studio.`)
    })
  }
  if (complete) return <div className="border-l-4 border-secondary bg-secondary-container p-5"><p className="font-semibold">{message}</p><a href="https://kurasikapa-studio.vercel.app/studio/en/sign-in" className="mt-4 inline-block font-bold text-primary underline">Open Studio sign in</a></div>
  return <form action={submit} className="space-y-5"><AuthField label="New password" name="password" type="password" placeholder="Create a strong password" autoComplete="new-password" icon="lock" minLength={8} /><AuthField label="Confirm password" name="confirm" type="password" placeholder="Repeat your password" autoComplete="new-password" icon="lock" minLength={8} /><button disabled={pending || token === ''} className="h-12 w-full bg-primary font-bold text-on-primary disabled:opacity-40">{pending ? 'Activating…' : 'Accept invitation'}</button>{message !== null && <p role="alert" className="text-sm text-error">{message}</p>}</form>
}

function text(value: FormDataEntryValue | null): string { return typeof value === 'string' ? value : '' }
