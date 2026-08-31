'use client'

import { ROLES, type Role } from '@kurasikapa/domain'
import { callAction } from '@kurasikapa/web-kit/actions/call'
import { useState, useTransition } from 'react'
import { invitePersonAction, resendInvitationAction, revokeInvitationAction } from '../actions/invitations'
import { RoleCheckboxes } from './role-checkboxes'

export interface InvitationView { readonly id: string; readonly email: string; readonly name: string; readonly roles: readonly string[]; readonly state: string; readonly expiresAt: string }

export function InvitationPanel({ invitations }: { invitations: readonly InvitationView[] }): React.ReactElement {
  const [rows, setRows] = useState(invitations)
  return <section className="border-y-2 border-on-surface bg-surface-container-lowest"><InviteForm onInvited={(row) => { setRows((current) => [row, ...current]) }} /><PendingList rows={rows} onChange={setRows} /></section>
}

function InviteForm({ onInvited }: { onInvited: (row: InvitationView) => void }): React.ReactElement {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [roles, setRoles] = useState<readonly Role[]>(['journalist'])
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const submit = (event: React.SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault(); setMessage(null)
    startTransition(async () => {
      const result = await callAction(() => invitePersonAction({ email, name, roles }))
      if (!result.ok) { setMessage(result.error.message); return }
      const now = new Date(); now.setDate(now.getDate() + 7)
      onInvited({ id: result.data.id, email, name, roles, state: 'pending', expiresAt: now.toISOString() })
      setEmail(''); setName(''); setMessage(result.data.emailSent ? 'Invitation emailed.' : `Email delivery failed. Copy this link: ${result.data.inviteUrl}`)
    })
  }
  return <form onSubmit={submit} className="border-b border-outline-variant p-5 md:p-7"><header><p className="broadcast-kicker text-primary">Controlled access</p><h2 className="mt-2 font-display text-3xl font-semibold">Invite a team member</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-on-surface-variant">They receive a one-time link that expires in seven days. Their account activates only after they set a password.</p></header><div className="mt-6 grid gap-4 md:grid-cols-2"><input required type="email" value={email} onChange={(event) => { setEmail(event.target.value) }} placeholder="person@example.com" className="h-12 px-4" /><input value={name} onChange={(event) => { setName(event.target.value) }} placeholder="Full name" className="h-12 px-4" /></div><RoleCheckboxes email={email || 'new team member'} roles={roles} disabled={pending} onToggle={(role) => { setRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]) }} /><p className="mt-3 text-xs text-on-surface-variant">Suggested newsroom roles: {ROLES.slice(2, 8).map((role) => role.replace(/_/gu, ' ')).join(' · ')}</p><div className="mt-5 flex flex-wrap items-center gap-4"><button disabled={pending || roles.length === 0} className="bg-primary px-6 py-3 text-sm font-bold text-on-primary disabled:opacity-40">{pending ? 'Sending…' : 'Send invitation'}</button>{message !== null && <p role="status" className="max-w-2xl break-all text-sm text-on-surface-variant">{message}</p>}</div></form>
}

function PendingList({ rows, onChange }: { rows: readonly InvitationView[]; onChange: (rows: readonly InvitationView[]) => void }): React.ReactElement {
  const [pending, startTransition] = useTransition()
  const active = rows.filter((row) => row.state === 'pending')
  if (active.length === 0) return <p className="p-6 text-sm text-on-surface-variant">No pending invitations.</p>
  const act = (kind: 'revoke' | 'resend', row: InvitationView): void => { startTransition(async () => {
    if (kind === 'resend') { await callAction(() => resendInvitationAction(row.id)); return }
    const result = await callAction(() => revokeInvitationAction(row.id))
    if (result.ok) onChange(rows.map((item) => item.id === row.id ? { ...item, state: 'revoked' } : item))
  }) }
  return <div>{active.map((row) => <article key={row.id} className="grid gap-4 border-b border-outline-variant p-5 md:grid-cols-[1fr_auto] md:items-center"><div><h3 className="font-semibold">{row.name || row.email}</h3><p className="text-sm text-on-surface-variant">{row.email} · {row.roles.map((role) => role.replace(/_/gu, ' ')).join(', ')}</p><p className="mt-1 text-xs text-on-surface-variant">Expires {new Intl.DateTimeFormat('en-GH', { dateStyle: 'medium' }).format(new Date(row.expiresAt))}</p></div><div className="flex gap-2"><button disabled={pending} onClick={() => { act('resend', row) }} className="border border-on-surface px-3 py-2 text-xs font-bold">Resend</button><button disabled={pending} onClick={() => { act('revoke', row) }} className="border border-error px-3 py-2 text-xs font-bold text-error">Revoke</button></div></article>)}</div>
}
