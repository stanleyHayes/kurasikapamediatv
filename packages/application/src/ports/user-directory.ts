import type { Role, UserId } from '@kurasikapa/domain'
import type { Cursor, Page } from './pagination'

export interface DirectoryUser {
  readonly id: UserId
  readonly email: string
  readonly name: string
  readonly roles: readonly Role[]
}

/**
 * Read-only view of who exists, for the roles screen.
 *
 * An anti-corruption boundary over the auth library's `user` collection: it
 * owns identity, we own roles, and this port is where the two are joined into
 * one thing an admin screen can render. Nothing outside the adapter learns
 * whose schema the rows came from — which is what makes ADR-0004's promise
 * ("replacing it is a data copy, not a redesign") true rather than aspirational.
 */
export interface UserDirectory {
  list(cursor: Cursor): Promise<Page<DirectoryUser>>
  /**
   * One user, or null. Invalid ids (fixture strings that are not ObjectIds)
   * are not found — never a driver error on the public article path.
   */
  findById(id: UserId): Promise<DirectoryUser | null>
}
