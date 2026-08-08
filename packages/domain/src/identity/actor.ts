import type { UserId } from '../shared/ids.js'
import { type Permission, type Role, permissionsOf } from './role.js'

/** Whoever is attempting an action. Carries identity and roles, nothing else. */
export class Actor {
  private readonly permissions: ReadonlySet<Permission>

  constructor(
    readonly id: UserId,
    readonly roles: readonly Role[],
  ) {
    this.permissions = permissionsOf(roles)
  }

  can(permission: Permission): boolean {
    return this.permissions.has(permission)
  }

  is(userId: UserId): boolean {
    return this.id === userId
  }
}

export class NotPermitted extends Error {
  constructor(
    readonly actorId: UserId,
    readonly permission: Permission,
  ) {
    super(`Actor ${actorId} lacks permission ${permission}`)
    this.name = 'NotPermitted'
  }
}

export function requirePermission(actor: Actor, permission: Permission): void {
  if (!actor.can(permission)) throw new NotPermitted(actor.id, permission)
}
