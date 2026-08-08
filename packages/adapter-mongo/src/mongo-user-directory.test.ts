import { userId } from '@kurasikapa/domain'
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

const addUser = async (id: string, email: string): Promise<void> => {
  await mongo.db.collection('user').insertOne({ _id: id, email, name: email } as never)
}

describe('list', () => {
  it('returns users with the roles we hold for them', async () => {
    await addUser('usr_1', 'editor@kurasikapa.tv')
    await roles.replace(userId('usr_1'), ['editor'])

    const page = await directory.list({ limit: 10 })

    expect(page.items[0]?.email).toBe('editor@kurasikapa.tv')
    expect(page.items[0]?.roles).toEqual(['editor'])
  })

  it('returns an empty role list for a reader who has been granted nothing', async () => {
    await addUser('usr_2', 'reader@example.com')

    const page = await directory.list({ limit: 10 })

    expect(page.items[0]?.roles).toEqual([])
  })

  it('drops a stored role the platform no longer defines', async () => {
    await addUser('usr_3', 'ghost@example.com')
    await mongo.db
      .collection('role_assignments')
      .insertOne({ _id: 'usr_3', roles: ['editor', 'chief_wizard'] } as never)

    const page = await directory.list({ limit: 10 })

    expect(page.items[0]?.roles).toEqual(['editor'])
  })

  it('pages without repeating', async () => {
    for (let i = 0; i < 5; i++) await addUser(`usr_${String(i)}`, `u${String(i)}@example.com`)

    const first = await directory.list({ limit: 2 })
    const second = await directory.list({ limit: 2, after: first.nextCursor ?? undefined })

    expect(first.items).toHaveLength(2)
    expect(second.items.map((u) => u.id)).not.toContain(first.items[0]?.id)
  })

  it('reads the roles for a page in one query, not one per user', async () => {
    // A 200-row directory would otherwise be 201 round trips.
    for (let i = 0; i < 3; i++) {
      await addUser(`usr_${String(i)}`, `u${String(i)}@example.com`)
      await roles.replace(userId(`usr_${String(i)}`), ['journalist'])
    }

    const page = await directory.list({ limit: 10 })

    expect(page.items.every((u) => u.roles.includes('journalist'))).toBe(true)
  })

  it('returns nothing for an empty platform', async () => {
    const page = await directory.list({ limit: 10 })

    expect(page).toEqual({ items: [], nextCursor: null })
  })
})
