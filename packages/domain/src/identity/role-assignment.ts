import type { UserId } from '../shared/ids'
import { type Actor, requirePermission } from './actor'
import { ROLES, type Role } from './role'

export class CannotAssignOwnRoles extends Error {
  constructor(readonly actorId: UserId) {
    super('An actor may not change their own roles')
    this.name = 'CannotAssignOwnRoles'
  }
}

export class UnknownRole extends Error {
  constructor(readonly role: string) {
    super(`"${role}" is not a role this platform defines`)
    this.name = 'UnknownRole'
  }
}

const KNOWN: ReadonlySet<string> = new Set(ROLES)

/**
 * The rules for changing who may do what.
 *
 * Self-assignment is refused even for a Super Admin. Without that, `role:assign`
 * is not a permission — it is a path to every other permission, and the audit
 * log shows one person quietly granting themselves whatever they needed.
 * Promoting someone requires a second person, which is the point.
 */
export function assertMayAssignRoles(
  actor: Actor,
  target: UserId,
  roles: readonly string[],
): asserts roles is readonly Role[] {
  requirePermission(actor, 'role:assign')

  if (actor.is(target)) throw new CannotAssignOwnRoles(actor.id)

  for (const role of roles) {
    // Roles arrive from an HTTP form. An unrecognised one must be refused, not
    // stored and silently ignored at permission-resolution time.
    if (!KNOWN.has(role)) throw new UnknownRole(role)
  }
}
