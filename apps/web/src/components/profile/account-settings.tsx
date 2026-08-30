'use client'

import { useEffect, useState, useTransition } from 'react'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import { changePasswordAction, updateProfileAction } from '../../actions/account-actions'
import { TwoFactorSettings } from '../auth/two-factor-settings'

type Theme = 'light' | 'dark' | 'system'
const FIELD = 'h-12 w-full border border-outline-variant bg-surface-container-lowest px-4 text-on-surface outline-none focus:border-primary'

export function AccountSettings({ name, email, locale }: { name: string; email: string; locale: string }): React.ReactElement {
  return <section className="mt-14 border border-outline-variant bg-surface-container-lowest"><header className="grid gap-4 border-b-4 border-primary bg-inverse-surface p-7 text-white md:grid-cols-[1fr_auto] md:items-end"><div><p className="eyebrow text-secondary">Account control room</p><h2 className="mt-3 font-display text-4xl font-semibold">Settings &amp; preferences</h2><p className="mt-3 max-w-2xl text-sm text-white/60">Your identity, reading language, appearance and account security—together in one place.</p></div><span className="text-xs font-bold uppercase tracking-widest text-secondary">Private to you</span></header><div className="divide-y divide-outline-variant"><ProfilePanel initialName={name} email={email}/><LanguagePanel locale={locale}/><ThemePanel/><SecurityPanel/></div></section>
}

function ProfilePanel({ initialName, email }: { initialName: string; email: string }): React.ReactElement {
  const [name, setName] = useState(initialName); const [message, setMessage] = useState<string | null>(null); const [pending, start] = useTransition()
  return <Panel number="01" title="Profile" description="The name readers see beside your contributions."><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">Display name</span><input className={FIELD} value={name} onChange={(e) => { setName(e.target.value) }}/></label><label><span className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">Email</span><input className={FIELD} value={email} disabled aria-describedby="email-note"/></label></div><p id="email-note" className="mt-3 text-xs text-on-surface-variant">Contact account support to change the sign-in email securely.</p><button type="button" disabled={pending} onClick={() => { start(async () => { const result = await updateProfileAction(name); setMessage(result.ok ? 'Profile updated.' : result.error.message) }) }} className="mt-5 bg-primary px-5 py-3 text-sm font-bold text-on-primary">{pending ? 'Saving…' : 'Save profile'}</button>{message && <p role="status" className="mt-3 text-sm text-on-surface-variant">{message}</p>}</Panel>
}

function LanguagePanel({ locale }: { locale: string }): React.ReactElement {
  return <Panel number="02" title="Language" description="Choose the edition used for navigation and account pages."><div className="flex gap-2"><Link href="/profile" locale="en" aria-current={locale === 'en' ? 'true' : undefined} className={`border px-5 py-3 text-sm font-bold ${locale === 'en' ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant'}`}>English</Link><Link href="/profile" locale="fr" aria-current={locale === 'fr' ? 'true' : undefined} className={`border px-5 py-3 text-sm font-bold ${locale === 'fr' ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant'}`}>Français</Link></div></Panel>
}

function ThemePanel(): React.ReactElement {
  const [theme, setTheme] = useState<Theme>('system')
  useEffect(() => {
    const saved = window.localStorage.getItem('kurasikapa-theme')
    const initial: Theme = saved === 'light' || saved === 'dark' ? saved : 'system'
    setTheme(initial)
    document.documentElement.dataset['theme'] = initial
  }, [])
  const choose = (value: Theme): void => { setTheme(value); window.localStorage.setItem('kurasikapa-theme', value); document.documentElement.dataset['theme'] = value }
  return <Panel number="03" title="Appearance" description="Match your device or choose the reading surface yourself."><div className="grid grid-cols-3 gap-2">{(['system', 'light', 'dark'] as const).map((value) => <button key={value} type="button" aria-pressed={theme === value} onClick={() => { choose(value) }} className={`border px-3 py-4 text-sm font-bold capitalize ${theme === value ? 'border-secondary bg-secondary text-on-secondary' : 'border-outline-variant'}`}>{value}</button>)}</div></Panel>
}

function SecurityPanel(): React.ReactElement {
  return <Panel number="04" title="Password & security" description="Change your password and add an authenticator as a second factor."><PasswordForm/><div className="mt-8 border-t border-outline-variant pt-7"><h4 className="font-display text-xl font-semibold">Two-factor authentication</h4><div className="mt-4 max-w-xl"><TwoFactorSettings/></div></div><Link href="/forgot-password" className="mt-6 inline-block text-sm font-semibold text-primary underline underline-offset-4">Cannot remember your password?</Link></Panel>
}

function PasswordForm(): React.ReactElement {
  const [message, setMessage] = useState<string | null>(null); const [pending, start] = useTransition()
  return <form className="grid max-w-2xl gap-4 sm:grid-cols-2" action={(data) => { start(async () => { const result = await changePasswordAction({ currentPassword: formValue(data, 'currentPassword'), newPassword: formValue(data, 'newPassword') }); setMessage(result.ok ? 'Password updated. Other sessions have been signed out.' : result.error.message) }) }}><label><span className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">Current password</span><input className={FIELD} name="currentPassword" type="password" autoComplete="current-password" required/></label><label><span className="mb-2 block text-xs font-bold uppercase text-on-surface-variant">New password</span><input className={FIELD} name="newPassword" type="password" minLength={12} autoComplete="new-password" required/></label><div className="sm:col-span-2"><button disabled={pending} className="bg-primary px-5 py-3 text-sm font-bold text-on-primary">{pending ? 'Updating…' : 'Update password'}</button>{message && <p role="status" className="mt-3 text-sm text-on-surface-variant">{message}</p>}</div></form>
}

function formValue(form: FormData, key: string): string {
  const value = form.get(key)
  return typeof value === 'string' ? value : ''
}

function Panel({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }): React.ReactElement {
  return <section className="grid gap-6 p-6 md:grid-cols-[4rem_15rem_1fr] md:p-8"><span className="font-display text-3xl font-bold text-secondary">{number}</span><div><h3 className="font-display text-2xl font-semibold text-on-surface">{title}</h3><p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{description}</p></div><div>{children}</div></section>
}
