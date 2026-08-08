import { Actor, type UserId } from '@kurasikapa/domain'
import type { RoleRepository } from '../ports/role-repository'
import type { UseCase } from '../ports/use-case'

export interface ResolveActorDeps {
  readonly roles: RoleRepository
}

export interface ResolveActorInput {
  /** The authenticated user id from the session, or null when signed out. */
  readonly userId: UserId | null
}

/**
 * Turns an authenticated identity into a domain Actor.
 *
 * This is the seam between "who someone is" (the auth library's job) and "what
 * they may do" (ours). Roles are read from our own store on every resolution
 * rather than carried in the session token — a revoked role must take effect on
 * the next request, not whenever the token happens to expire.
 */
export class ResolveActor implements UseCase<ResolveActorInput, Actor | null> {
  constructor(private readonly deps: ResolveActorDeps) {}

  async execute(input: ResolveActorInput): Promise<Actor | null> {
    if (input.userId === null) return null

    const roles = await this.deps.roles.rolesFor(input.userId)

    return new Actor(input.userId, roles)
  }
}
