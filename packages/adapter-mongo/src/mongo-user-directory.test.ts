import { userId } from '@kurasikapa/domain'
import { ObjectId } from 'mongodb'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MongoRoleRepository } from './mongo-role-repository'
import { MongoUserDirectory } from './mongo-user-directory'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness
let directory: MongoUserDirectory
let roles: MongoRoleRepository

beforeAll(async () => {
  mongo = await startMongo()
  directory = new MongoUserDirectory(mongo.db)
  roles = new MongoRoleRepository(mongo.db)
})

afterEach(async () => {
  await mongo.reset()
})

afterAll(async () => {
  await mongo.stop()
})

/** A deterministic, ascending 24-hex id, so paging order is predictable. */
const oid = (n: number): string => String(n).padStart(24, '0')

const addUser = async (id: string, email: string): Promise<void> => {
  // Better Auth lets Mongo mint the key, so these are ObjectIds — not the
  // readable strings it would be tempting to use here. Seeding strings is what
  // hid a real defect: the code compared an ObjectId to a hex string and
  // always came up empty, and a test that seeded strings agreed with it.
  await mongo.db
    .collection('user')
    .insertOne({ _id: ObjectId.createFromHexString(id), email, name: email })
}

describe('list', () => {
  it('returns users with the roles we hold for them', async () => {
    await addUser(oid(1), 'editor@kurasikapa.tv')
    await roles.replace(userId(oid(1)), ['editor'])

    const page = await directory.list({ limit: 10 })

    expect(page.items[0]?.email).toBe('editor@kurasikapa.tv')
    expect(page.items[0]?.roles).toEqual(['editor'])
  })

  it('returns an empty role list for a reader who has been granted nothing', async () => {
    await addUser(oid(2), 'reader@example.com')

    const page = await directory.list({ limit: 10 })

    expect(page.items[0]?.roles).toEqual([])
  })

  it('drops a stored role the platform no longer defines', async () => {
    await addUser(oid(3), 'ghost@example.com')
    await mongo.db
      .collection('role_assignments')
      .insertOne({ _id: oid(3), roles: ['editor', 'chief_wizard'] } as never)

    const page = await directory.list({ limit: 10 })

    expect(page.items[0]?.roles).toEqual(['editor'])
  })

  it('pages without repeating', async () => {
    for (let i = 0; i < 5; i++) await addUser(oid(i), `u${String(i)}@example.com`)

    const first = await directory.list({ limit: 2 })
    const second = await directory.list({ limit: 2, after: first.nextCursor ?? undefined })

    expect(first.items).toHaveLength(2)
    expect(second.items.map((u) => u.id)).not.toContain(first.items[0]?.id)
  })

  it('reads the roles for a page in one query, not one per user', async () => {
    // A 200-row directory would otherwise be 201 round trips.
    for (let i = 0; i < 3; i++) {
      await addUser(oid(i), `u${String(i)}@example.com`)
      await roles.replace(userId(oid(i)), ['journalist'])
    }

    const page = await directory.list({ limit: 10 })

    expect(page.items.every((u) => u.roles.includes('journalist'))).toBe(true)
  })

  it('returns nothing for an empty platform', async () => {
    const page = await directory.list({ limit: 10 })

    expect(page).toEqual({ items: [], nextCursor: null })
  })
})
