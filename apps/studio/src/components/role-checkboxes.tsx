'use client'

import { ROLES, type Role } from '@kurasikapa/domain'

const ROLE_DESCRIPTIONS: Readonly<Record<Role, string>> = {
  super_admin: 'Full platform access, including assigning roles.',
  administrator: 'All operations except assigning roles.',
  editor: 'Review, approve, publish and moderate newsroom work.',
  journalist: 'Draft, edit and submit original reporting.',
  author: 'Draft and submit their own articles.',
  photographer: 'Upload and manage newsroom photography.',
  video_editor: 'Upload video and operate live broadcasts.',
  social_media_manager: 'Prepare and publish social distribution.',
  advertiser: 'Submit and track their own campaign proposals.',
  subscriber: 'Reader account with no Studio permissions.',
  guest: 'Basic account with no Studio permissions.',
}

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
          <label key={role} title={ROLE_DESCRIPTIONS[role]} className="flex cursor-pointer items-center gap-3 border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant has-[:checked]:border-secondary has-[:checked]:bg-secondary-container has-[:checked]:text-on-secondary-container">
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
