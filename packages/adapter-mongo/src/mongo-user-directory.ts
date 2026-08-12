import type { Cursor, DirectoryUser, Page, UserDirectory } from '@kurasikapa/application'
import { ROLES, type Role, type UserId, userId } from '@kurasikapa/domain'
import { ObjectId, type Collection, type Db } from 'mongodb'
import { ROLE_ASSIGNMENTS, type RoleAssignmentDocument } from './documents'

/** Better Auth owns this collection and its shape. We only ever read it. */
const USERS = 'user'

/**
 * `_id` is an ObjectId, not a string.
 *
 * Better Auth lets Mongo mint the key, so the driver hands back an ObjectId
 * while its API reports `user.id` as the hex string. This interface once
 * claimed `string`; TypeScript then happily compared an ObjectId against a
 * hex string, every role lookup missed, and users appeared with no roles at
 * all. Typing it truthfully is what forces the conversions below.
 */
interface AuthUserDocument {
  _id: ObjectId
  email: string
  name: string
}

/** The id shape the rest of the system uses: Better Auth's `user.id`. */
const hex = (id: ObjectId): string => id.toHexString()

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
    // The cursor travels as a hex string, so it has to become an ObjectId
    // again to compare against the stored key. ObjectIds sort by their leading
    // timestamp, which keeps keyset pagination stable.
    const filter =
      cursor.after === undefined ? {} : { _id: { $gt: ObjectId.createFromHexString(cursor.after) } }

    const docs = await this.users
      .find(filter)
      .sort({ _id: 1 })
      .limit(cursor.limit + 1)
      .toArray()

    const page = docs.slice(0, cursor.limit)
    const hasMore = docs.length > cursor.limit
    const last = page.at(-1)

    // One query for the page's roles rather than one per user: a 200-row
    // directory would otherwise be 201 round trips.
    const roles = await this.rolesFor(page.map((d) => hex(d._id)))

    return {
      items: page.map((doc) => ({
        id: userId(hex(doc._id)),
        email: doc.email,
        name: doc.name,
        roles: roles.get(hex(doc._id)) ?? [],
      })),
      nextCursor: hasMore && last !== undefined ? hex(last._id) : null,
    }
  }

  async findById(id: UserId): Promise<DirectoryUser | null> {
    const oid = objectIdOf(id)
    if (oid === null) return null

    const doc = await this.users.findOne({ _id: oid })
    if (doc === null) return null

    const roles = await this.rolesFor([hex(doc._id)])
    return {
      id: userId(hex(doc._id)),
      email: doc.email,
      name: doc.name,
      roles: roles.get(hex(doc._id)) ?? [],
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

/** Fixture ids like `usr_author` must miss, not throw, on the public path. */
function objectIdOf(id: UserId): ObjectId | null {
  try {
    return ObjectId.createFromHexString(id)
  } catch {
    return null
  }
}
