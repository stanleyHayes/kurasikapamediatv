import type { RoleRepository } from '@kurasikapa/application'
import { ROLES, type Role, type UserId } from '@kurasikapa/domain'
import type { Collection, Db } from 'mongodb'
import { ROLE_ASSIGNMENTS, type RoleAssignmentDocument } from './documents'

const KNOWN: ReadonlySet<string> = new Set(ROLES)

export class MongoRoleRepository implements RoleRepository {
  private readonly assignments: Collection<RoleAssignmentDocument>

  constructor(db: Db) {
    this.assignments = db.collection<RoleAssignmentDocument>(ROLE_ASSIGNMENTS)
  }

  async rolesFor(userId: UserId): Promise<readonly Role[]> {
    const doc = await this.assignments.findOne({ _id: userId })
    if (doc === null) return []

    // Storage is not a trust boundary we can assume. A role removed from the
    // codebase would otherwise arrive as a live grant that resolves to
    // nothing — silently, at permission-check time.
    return doc.roles.filter((r): r is Role => KNOWN.has(r))
  }

  async replace(userId: UserId, roles: readonly Role[]): Promise<void> {
    if (roles.length === 0) {
      // No empty document left behind: absence and "granted nothing" are the
      // same state, and keeping one row per signed-up reader is waste.
      await this.assignments.deleteOne({ _id: userId })
      return
    }

    await this.assignments.updateOne(
      { _id: userId },
      { $set: { roles: [...roles] } },
      { upsert: true },
    )
  }
}
