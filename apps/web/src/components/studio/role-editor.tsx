'use client'

import type { Role } from '@kurasikapa/domain'
import { useState, useTransition } from 'react'
import { assignRolesAction } from '../../actions/editorial'
import { RoleCheckboxes } from './role-checkboxes'

export interface PersonView {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly roles: readonly string[]
}

/**
 * Role assignment for one person.
 *
 * The checkboxes are convenience; the domain is the control. Self-assignment
 * and unknown roles are refused by `assertMayAssignRoles` regardless of what
 * this form sends, and the failure surfaces here rather than silently.
 */
function PersonHeader(props: {
  person: PersonView
  pending: boolean
  state: 'idle' | 'saved' | 'error'
  message: string | null
}): React.ReactElement {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <p className="text-on-surface font-medium">{props.person.name}</p>
        <p className="text-on-surface-variant text-sm">{props.person.email}</p>
      </div>
      <p aria-live="polite" className="text-sm">
        {props.pending && <span className="text-on-surface-variant">Saving…</span>}
        {!props.pending && props.state === 'saved' && <span className="text-secondary">Saved</span>}
        {!props.pending && props.state === 'error' && (
          <span className="text-error">{props.message}</span>
        )}
      </p>
    </div>
  )
}

export function RoleEditor({
  person,
  isSelf,
}: {
  person: PersonView
  isSelf: boolean
}): React.ReactElement {
  const [roles, setRoles] = useState<readonly string[]>(person.roles)
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const toggle = (role: Role): void => {
    const next = roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role]
    setRoles(next)
    setState('idle')

    startTransition(async () => {
      const result = await assignRolesAction({ targetUserId: person.id, roles: next })

      if (result.ok) {
        setState('saved')
        setMessage(null)
        return
      }

      // Put the server's truth back on screen rather than leaving a checkbox
      // showing a change that did not happen.
      setRoles(person.roles)
      setState('error')
      setMessage(result.error.message)
    })
  }

  return (
    <li className="border-outline-variant border-b py-4">
      <PersonHeader person={person} pending={pending} state={state} message={message} />

      <RoleCheckboxes
        email={person.email}
        roles={roles}
        disabled={isSelf}
        onToggle={toggle}
      />

      {isSelf && (
        <p className="text-on-surface-variant mt-2 text-sm">
          You cannot change your own roles — promotion takes a second person.
        </p>
      )}
    </li>
  )
}
