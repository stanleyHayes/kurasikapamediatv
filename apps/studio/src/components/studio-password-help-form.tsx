'use client'

import { useState } from 'react'

const SUPPORT_EMAIL = 'kurasikapamediatv@yahoo.com'
const FIELD = 'h-14 w-full border border-outline-variant bg-surface-container-lowest px-4 text-on-surface outline-none focus:border-primary'

export function StudioPasswordHelpForm({ signInUrl }: { signInUrl: string }): React.ReactElement {
  const [opened, setOpened] = useState(false)

  const submit = (form: FormData): void => {
    const email = value(form, 'email').trim()
    const subject = encodeURIComponent('Kurasikapa Studio account recovery')
    const body = encodeURIComponent(`Please help me recover the Studio account registered to ${email}.`)
    setOpened(true)
    window.location.assign(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`)
  }

  return (
    <div className="space-y-6">
      <form action={submit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-2"><span className="text-sm font-semibold">Account email</span><input name="email" type="email" autoComplete="email" required className={FIELD} /></label>
        <div className="border-secondary bg-surface-container-low border-l-4 px-4 py-3 text-sm leading-6 text-on-surface-variant">Our account team verifies ownership before making changes. Never include your password in the message.</div>
        <button type="submit" className="bg-primary text-on-primary h-13 px-5 text-sm font-bold">Contact account support</button>
        {opened && <p role="status" className="text-sm text-on-surface-variant">Your email app should now be open. If it did not open, write to <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold underline">{SUPPORT_EMAIL}</a>.</p>}
      </form>
      <a href={signInUrl} className="text-primary inline-flex text-sm font-bold underline underline-offset-4">Return to Studio sign in</a>
    </div>
  )
}

function value(form: FormData, key: string): string {
  const found = form.get(key)
  return typeof found === 'string' ? found : ''
}
