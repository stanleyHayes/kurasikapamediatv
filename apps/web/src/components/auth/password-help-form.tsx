'use client'

import { useState } from 'react'
import { AuthField } from './auth-field'

const SUPPORT_EMAIL = 'kurasikapamediatv@yahoo.com'

export function PasswordHelpForm(): React.ReactElement {
  const [opened, setOpened] = useState(false)

  const submit = (form: FormData): void => {
    const email = formValue(form, 'email').trim()
    const subject = encodeURIComponent('Kurasikapa account recovery')
    const body = encodeURIComponent(`Please help me recover the Kurasikapa account registered to ${email}.`)
    setOpened(true)
    window.location.assign(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`)
  }

  return (
    <form action={submit} className="flex flex-col gap-5">
      <AuthField label="Account email" name="email" type="email" autoComplete="email" placeholder="you@example.com" icon="email" />
      <p className="border-l-4 border-secondary bg-surface-container-low px-4 py-3 text-sm leading-relaxed text-on-surface-variant">
        We verify account ownership before making changes. Never include your password in the message.
      </p>
      <button type="submit" className="bg-primary text-on-primary hover:bg-on-primary-container h-13 w-full px-5 text-sm font-bold transition-colors">
        Contact account support
      </button>
      {opened && <p role="status" className="text-sm leading-relaxed text-on-surface-variant">Your email app should now be open. If it did not open, write to <a className="font-semibold underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>}
    </form>
  )
}

function formValue(form: FormData, key: string): string {
  const value = form.get(key)
  return typeof value === 'string' ? value : ''
}
