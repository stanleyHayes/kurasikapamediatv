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
          <label key={role} className="text-on-surface-variant flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={roles.includes(role)}
              onChange={() => {
                onToggle(role)
              }}
            />
            {role.replace(/_/gu, ' ')}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
