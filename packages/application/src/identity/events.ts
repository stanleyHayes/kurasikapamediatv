import type { Role, UserId } from '@kurasikapa/domain'
import type { DomainEvent } from '../ports/ambient'

export interface RolesAssigned extends DomainEvent {
  readonly name: 'identity.roles_assigned'
  readonly actorId: UserId
  readonly targetUserId: UserId
  /** The full resulting set, not a delta — the audit log should not need replaying. */
  readonly roles: readonly Role[]
}

export const rolesAssigned = (
  actorId: UserId,
  targetUserId: UserId,
  roles: readonly Role[],
  occurredAt: Date,
): RolesAssigned => ({
  name: 'identity.roles_assigned',
  actorId,
  targetUserId,
  roles,
  occurredAt,
})
