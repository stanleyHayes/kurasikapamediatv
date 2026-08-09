import { RoleEditor } from './role-editor'

export interface Member {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly roles: readonly string[]
}

/** Initials from a display name, for the avatar slot the design draws. */
const initials = (name: string, email: string): string => {
  const source = name.trim() === '' ? email : name
  const parts = source.split(/[\s@.]+/u).filter(Boolean)

  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * One row of the members table, per the Stitch roles design: avatar and
 * identity, then the role controls.
 *
 * The design lays out five columns — Member, Role, Department, Status,
 * Actions. Department and Status are dropped rather than faked: there is no
 * org structure in the model, and "Active/Offline" needs presence tracking
 * that does not exist. Inventing either would put a fact on an admin screen
 * that nobody can act on, and the roles this screen exists to manage are real.
 *
 * The role controls stay editable inline rather than behind the design's
 * slide-in panel. A panel is worth building when there are permissions to
 * toggle independently of roles; today a role IS the permission set, so the
 * panel would be a second click to reach the same checkboxes.
 */
export function MemberRow({
  person,
  isSelf,
}: {
  person: Member
  isSelf: boolean
}): React.ReactElement {
  return (
    <li className="border-outline-variant/60 grid grid-cols-1 items-start gap-4 border-b px-6 py-4 last:border-0 md:grid-cols-12">
      <div className="flex items-center gap-3 md:col-span-4">
        <span
          aria-hidden
          className="bg-primary-container text-on-primary-container text-label-bold flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        >
          {initials(person.name, person.email)}
        </span>

        <span className="min-w-0">
          <span className="text-on-surface block truncate font-medium">
            {person.name.trim() === '' ? person.email : person.name}
          </span>
          <span className="text-on-surface-variant block truncate text-sm">{person.email}</span>
        </span>
      </div>

      <div className="md:col-span-8">
        <RoleEditor isSelf={isSelf} person={{ ...person, roles: [...person.roles] }} />
      </div>
    </li>
  )
}
