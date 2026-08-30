'use client'

import { ROLES, type Role } from '@kurasikapa/domain'

/**
 * Checkboxes are convenience; the domain is the control.
 * `assertMayAssignRoles` refuses self-assignment and unknown roles whatever
 * this form sends.
 */
export function RoleCheckboxes({
  email,
  roles,
  disabled,
  onToggle,
}: {
  email: string
  roles: readonly string[]
  disabled: boolean
  onToggle: (role: Role) => void
}): React.ReactElement {
  return (
    <fieldset className="mt-3" disabled={disabled}>
      <legend className="sr-only">Roles for {email}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {ROLES.map((role) => (
          <label key={role} className="flex cursor-pointer items-center gap-3 border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant has-[:checked]:border-secondary has-[:checked]:bg-secondary-container has-[:checked]:text-on-secondary-container">
            <input
              type="checkbox"
              checked={roles.includes(role)}
              onChange={() => {
                onToggle(role)
              }}
              className="peer sr-only"
            />
            <span aria-hidden className="grid size-5 place-items-center border-2 border-outline text-transparent peer-checked:border-secondary peer-checked:bg-secondary peer-checked:text-on-secondary">✓</span>
            {role.replace(/_/gu, ' ')}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
