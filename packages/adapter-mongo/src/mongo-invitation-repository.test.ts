import type { InvitationRecord } from '@kurasikapa/application'
import { userId } from '@kurasikapa/domain'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MongoInvitationRepository } from './mongo-invitation-repository'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness
let repo: MongoInvitationRepository
const NOW = new Date('2026-08-31T10:00:00.000Z')
const invitation = (overrides: Partial<InvitationRecord> = {}): InvitationRecord => ({ id: 'invite_1', email: 'ama@example.com', name: 'Ama', roles: ['editor'], tokenHash: 'hash_1', invitedBy: userId('admin'), createdAt: NOW, expiresAt: new Date(NOW.getTime() + 60_000), state: 'pending', ...overrides })

beforeAll(async () => { mongo = await startMongo(); repo = new MongoInvitationRepository(mongo.db) })
afterEach(async () => { await mongo.reset() })
afterAll(async () => { await mongo.stop() })

describe('MongoInvitationRepository', () => {
  it('round trips, finds and lists a pending role invitation', async () => {
    await repo.create(invitation())
    expect(await repo.findByTokenHash('hash_1')).toEqual(invitation())
    expect(await repo.findPendingByEmail('ama@example.com')).toEqual(invitation())
    expect(await repo.list()).toEqual([invitation()])
  })

  it('replaces state and no longer reports the row as pending', async () => {
    await repo.create(invitation())
    await repo.replace(invitation({ state: 'revoked' }))
    expect(await repo.findPendingByEmail('ama@example.com')).toBeNull()
    expect((await repo.list())[0]?.state).toBe('revoked')
  })

  it('refuses another pending invitation for the same email', async () => {
    await repo.create(invitation())
    await expect(repo.create(invitation({ id: 'invite_2', tokenHash: 'hash_2' }))).rejects.toThrow('pending invitation already exists')
  })

  it('returns null for an unknown token', async () => {
    expect(await repo.findByTokenHash('missing')).toBeNull()
  })
})
