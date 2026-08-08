import type { Cursor, DirectoryUser, Page, UserDirectory } from '@kurasikapa/application'
import { ROLES, type Role, userId } from '@kurasikapa/domain'
import type { Collection, Db } from 'mongodb'
import { ROLE_ASSIGNMENTS, type RoleAssignmentDocument } from './documents'

/** Better Auth owns this collection and its shape. We only ever read it. */
const USERS = 'user'

interface AuthUserDocument {
  _id: string
  email: string
  name: string
}

const KNOWN: ReadonlySet<string> = new Set(ROLES)

/**
 * Joins the auth library's users to our role assignments.
 *
 * The only place in the codebase that reads Better Auth's collection, and it
 * reads it read-only. That containment is what makes ADR-0004's claim honest:
 * swapping the auth library means rewriting this one file, not the roles
 * model, the use cases, or the screen.
 */
export class MongoUserDirectory implements UserDirectory {
  private readonly users: Collection<AuthUserDocument>
  private readonly assignments: Collection<RoleAssignmentDocument>

  constructor(db: Db) {
    this.users = db.collection<AuthUserDocument>(USERS)
    this.assignments = db.collection<RoleAssignmentDocument>(ROLE_ASSIGNMENTS)
  }

  async list(cursor: Cursor): Promise<Page<DirectoryUser>> {
    const filter = cursor.after === undefined ? {} : { _id: { $gt: cursor.after } }

    const docs = await this.users
      .find(filter)
      .sort({ _id: 1 })
      .limit(cursor.limit + 1)
      .toArray()

    const page = docs.slice(0, cursor.limit)
    const hasMore = docs.length > cursor.limit

    // One query for the page's roles rather than one per user: a 200-row
    // directory would otherwise be 201 round trips.
    const roles = await this.rolesFor(page.map((d) => d._id))

    return {
      items: page.map((doc) => ({
        id: userId(doc._id),
        email: doc.email,
        name: doc.name,
        roles: roles.get(doc._id) ?? [],
      })),
      nextCursor: hasMore ? (page.at(-1)?._id ?? null) : null,
    }
  }

  private async rolesFor(ids: readonly string[]): Promise<Map<string, Role[]>> {
    if (ids.length === 0) return new Map()

    const docs = await this.assignments.find({ _id: { $in: [...ids] } }).toArray()

    return new Map(
      // Storage is not a trust boundary: a role removed from the codebase must
      // not resurface here as a live grant.
      docs.map((doc) => [doc._id, doc.roles.filter((r): r is Role => KNOWN.has(r))]),
    )
  }
}
