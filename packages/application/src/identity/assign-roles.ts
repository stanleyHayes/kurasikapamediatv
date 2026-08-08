import { type Actor, type Role, type UserId, assertMayAssignRoles } from '@kurasikapa/domain'
import type { ClockPort, EventBusPort } from '../ports/ambient'
import type { RoleRepository } from '../ports/role-repository'
import type { UseCase } from '../ports/use-case'
import { rolesAssigned } from './events'

export interface AssignRolesDeps {
  readonly roles: RoleRepository
  readonly clock: ClockPort
  readonly events: EventBusPort
}

export interface AssignRolesInput {
  readonly actor: Actor
  readonly targetUserId: UserId
  /** Unvalidated strings from a form. The domain decides whether they are roles. */
  readonly roles: readonly string[]
}

export interface AssignRolesResult {
  readonly userId: UserId
  readonly roles: readonly Role[]
}

/**
 * Replaces a user's roles outright rather than adding to them, so the admin
 * screen shows the full set and saves the full set. Incremental grants make it
 * hard to answer "what can this person do?" from one place.
 */
export class AssignRoles implements UseCase<AssignRolesInput, AssignRolesResult> {
  constructor(private readonly deps: AssignRolesDeps) {}

  async execute(input: AssignRolesInput): Promise<AssignRolesResult> {
    // Throws on missing permission, self-assignment, or an unknown role, and
    // narrows the strings to Role[] on the way through.
    assertMayAssignRoles(input.actor, input.targetUserId, input.roles)

    await this.deps.roles.replace(input.targetUserId, input.roles)
    await this.deps.events.publish(
      rolesAssigned(input.actor.id, input.targetUserId, input.roles, this.deps.clock.now()),
    )

    return { userId: input.targetUserId, roles: input.roles }
  }
}
