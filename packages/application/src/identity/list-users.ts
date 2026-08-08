import { type Actor, requirePermission } from '@kurasikapa/domain'
import { type Page, clampLimit } from '../ports/pagination'
import type { UseCase } from '../ports/use-case'
import type { DirectoryUser, UserDirectory } from '../ports/user-directory'

export interface ListUsersDeps {
  readonly users: UserDirectory
}

export interface ListUsersInput {
  readonly actor: Actor
  readonly after?: string | undefined
  readonly limit?: number | undefined
}

const LIMITS = { fallback: 50, max: 200 }

/**
 * The people directory behind the roles screen.
 *
 * Gated on `role:assign` rather than on merely being staff: the list is every
 * registered email on the platform, including readers. That is a disclosure in
 * its own right, quite apart from what you can do with it.
 */
export class ListUsers implements UseCase<ListUsersInput, Page<DirectoryUser>> {
  constructor(private readonly deps: ListUsersDeps) {}

  async execute(input: ListUsersInput): Promise<Page<DirectoryUser>> {
    requirePermission(input.actor, 'role:assign')

    const page = await this.deps.users.list({
      after: input.after,
      limit: clampLimit(input.limit, LIMITS),
    })

    return page
  }
}
