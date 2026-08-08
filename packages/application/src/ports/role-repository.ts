import type { Role, UserId } from '@kurasikapa/domain'

/**
 * Role assignments live in our own collection, not in the auth library's user
 * document.
 *
 * Better Auth owns `user`, `session`, `account` and `verification`. We own
 * `role_assignments`. That keeps the vendor's schema out of the domain and
 * makes replacing the auth library a data copy rather than a redesign.
 * See ADR-0004.
 */
export interface RoleRepository {
  /** Empty for a signed-in reader who has been granted nothing. */
  rolesFor(userId: UserId): Promise<readonly Role[]>
  replace(userId: UserId, roles: readonly Role[]): Promise<void>
}
