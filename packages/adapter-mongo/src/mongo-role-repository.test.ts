import { userId } from '@kurasikapa/domain'
import type { Collection } from 'mongodb'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ROLE_ASSIGNMENTS, type RoleAssignmentDocument } from './documents'
import { MongoRoleRepository } from './mongo-role-repository'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness
let repo: MongoRoleRepository

beforeAll(async () => {
  mongo = await startMongo()
  repo = new MongoRoleRepository(mongo.db)
})

afterEach(async () => {
  await mongo.reset()
})

afterAll(async () => {
  await mongo.stop()
})

const EDITOR = userId('usr_editor')

const raw = (): Collection<RoleAssignmentDocument> =>
  mongo.db.collection<RoleAssignmentDocument>(ROLE_ASSIGNMENTS)

describe('rolesFor', () => {
  it('returns nothing for a user with no grants', async () => {
    expect(await repo.rolesFor(EDITOR)).toEqual([])
  })

  it('round trips an assignment', async () => {
    await repo.replace(EDITOR, ['editor', 'journalist'])
    expect(await repo.rolesFor(EDITOR)).toEqual(['editor', 'journalist'])
  })

  it('drops a stored role the platform no longer defines', async () => {
    // Storage is not a trust boundary. A role deleted from the codebase would
    // otherwise arrive as a live grant that silently resolves to nothing.
    await raw().insertOne({ _id: EDITOR, roles: ['editor', 'chief_wizard'] })

    expect(await repo.rolesFor(EDITOR)).toEqual(['editor'])
  })
})

describe('replace', () => {
  it('overwrites rather than merging', async () => {
    await repo.replace(EDITOR, ['editor'])
    await repo.replace(EDITOR, ['photographer'])

    expect(await repo.rolesFor(EDITOR)).toEqual(['photographer'])
  })

  it('removes the document entirely when revoking everything', async () => {
    // Absence and "granted nothing" are the same state. Keeping an empty row
    // per signed-up reader is waste on a consumer news site.
    await repo.replace(EDITOR, ['editor'])
    await repo.replace(EDITOR, [])

    expect(await raw().countDocuments()).toBe(0)
    expect(await repo.rolesFor(EDITOR)).toEqual([])
  })

  it('revoking a user who never had roles is not an error', async () => {
    await expect(repo.replace(EDITOR, [])).resolves.toBeUndefined()
  })

  it('keeps users independent', async () => {
    const other = userId('usr_other')
    await repo.replace(EDITOR, ['editor'])
    await repo.replace(other, ['photographer'])

    expect(await repo.rolesFor(EDITOR)).toEqual(['editor'])
    expect(await repo.rolesFor(other)).toEqual(['photographer'])
  })
})
