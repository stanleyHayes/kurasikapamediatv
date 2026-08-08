import type { Role, UserId } from '@kurasikapa/domain'
import type { RoleRepository } from '../ports/role-repository'

export class InMemoryRoleRepository implements RoleRepository {
  private readonly store = new Map<string, readonly Role[]>()

  constructor(seed: Readonly<Record<string, readonly Role[]>> = {}) {
    for (const [id, roles] of Object.entries(seed)) this.store.set(id, roles)
  }

  rolesFor(userId: UserId): Promise<readonly Role[]> {
    return Promise.resolve(this.store.get(userId) ?? [])
  }

  replace(userId: UserId, roles: readonly Role[]): Promise<void> {
    this.store.set(userId, [...roles])
    return Promise.resolve()
  }
}
