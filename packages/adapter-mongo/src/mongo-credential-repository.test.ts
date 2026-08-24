import { Credential, EmailAddress, userId as toUserId } from '@kurasikapa/domain'
import { ObjectId } from 'mongodb'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { CREDENTIALS, LEGACY_ACCOUNTS, LEGACY_TWO_FACTOR, LEGACY_USERS } from './documents'
import { MongoCredentialRepository } from './mongo-credential-repository'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness
let repo: MongoCredentialRepository

beforeAll(async () => {
  mongo = await startMongo()
  repo = new MongoCredentialRepository(mongo.db)
})

afterEach(async () => {
  await mongo.reset()
})

afterAll(async () => {
  await mongo.stop()
})

const EMAIL = 'editor@kurasikapa.tv'
const NATIVE_HASH = 'scrypt$65536$8$2$c2FsdA$aGFzaA'
/** `salt:key` hex — Better Auth's shape. The value need not verify here. */
const LEGACY_HASH = `${'a'.repeat(32)}:${'b'.repeat(128)}`

const native = (email = EMAIL): Credential =>
  Credential.reconstitute({
    userId: toUserId('user_native'),
    email: EmailAddress.of(email),
    passwordHash: NATIVE_HASH,
    externals: [],
    totp: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  })

/** Seeds the two rows Better Auth writes for a password account. */
async function seedLegacy(options: { email?: string; twoFactor?: boolean } = {}): Promise<string> {
  const id = new ObjectId()
  await mongo.db.collection(LEGACY_USERS).insertOne({
    _id: id,
    email: options.email ?? EMAIL,
    createdAt: new Date('2025-06-01T00:00:00.000Z'),
  })
  await mongo.db.collection(LEGACY_ACCOUNTS).insertOne({
    userId: id.toHexString(),
    providerId: 'credential',
    password: LEGACY_HASH,
  })
  if (options.twoFactor === true) {
    await mongo.db.collection(LEGACY_TWO_FACTOR).insertOne({ userId: id.toHexString() })
  }

  return id.toHexString()
}

describe('findByEmail', () => {
  it('returns the native row when there is one', async () => {
    await repo.create(native())
    const found = await repo.findByEmail(EmailAddress.of(EMAIL))

    expect(found?.passwordHash).toBe(NATIVE_HASH)
  })

  it('falls back to the Better Auth row, so existing accounts can still sign in', async () => {
    // Without this every account that predates KUR-66 reads as "those details
    // did not match an account" the moment the custom stack owns sign-in.
    await seedLegacy()
    const found = await repo.findByEmail(EmailAddress.of(EMAIL))

    expect(found?.passwordHash).toBe(LEGACY_HASH)
  })

  it('prefers the native row once one exists, so migration is one-way', async () => {
    const id = await seedLegacy()
    await repo.update(
      Credential.reconstitute({
        userId: toUserId(id),
        email: EmailAddress.of(EMAIL),
        passwordHash: NATIVE_HASH,
        externals: [],
        totp: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    )

    const found = await repo.findByEmail(EmailAddress.of(EMAIL))
    expect(found?.passwordHash).toBe(NATIVE_HASH)
  })

  it('REFUSES an account with Better Auth two-factor enrolled', async () => {
    // Its secret lives in a schema this stack does not read, so migrating the
    // account would hand back `totp: null` and sign the user in on a password
    // alone. Silently removing someone's second factor is worse than refusing.
    await seedLegacy({ twoFactor: true })

    expect(await repo.findByEmail(EmailAddress.of(EMAIL))).toBeNull()
  })

  it('ignores a legacy user with no password row — a provider-only account', async () => {
    const id = new ObjectId()
    await mongo.db.collection(LEGACY_USERS).insertOne({ _id: id, email: EMAIL })

    expect(await repo.findByEmail(EmailAddress.of(EMAIL))).toBeNull()
  })

  it('returns null when neither store knows the address', async () => {
    expect(await repo.findByEmail(EmailAddress.of('nobody@kurasikapa.tv'))).toBeNull()
  })
})

describe('findByUserId', () => {
  it('matches a legacy user by the hex form of its ObjectId', async () => {
    // Better Auth writes `user._id` as an ObjectId while everything
    // downstream uses the hex string. Matching the raw value finds nothing,
    // and the account resolves with no roles — the bug the seed script
    // already carries a comment about.
    const id = await seedLegacy()

    expect((await repo.findByUserId(toUserId(id)))?.email.value).toBe(EMAIL)
  })
})

describe('update', () => {
  it('upserts, so the rehash during sign-in creates the migrated row', async () => {
    // SignInWithPassword rehashes when needsRehash is true — which it is for a
    // Better Auth hash — and calls update. A non-upserting update writes
    // nothing, the fallback is consulted forever and the legacy hash outlives
    // the migration.
    const id = await seedLegacy()

    await repo.update(
      Credential.reconstitute({
        userId: toUserId(id),
        email: EmailAddress.of(EMAIL),
        passwordHash: NATIVE_HASH,
        externals: [],
        totp: null,
        createdAt: new Date('2026-02-02T00:00:00.000Z'),
        updatedAt: new Date('2026-02-02T00:00:00.000Z'),
      }),
    )

    const row = await mongo.db.collection(CREDENTIALS).findOne({ _id: id as never })
    expect(row?.['passwordHash']).toBe(NATIVE_HASH)
  })

  it('does not backdate an existing row on a later write', async () => {
    await repo.create(native())
    const created = new Date('2026-01-01T00:00:00.000Z')

    await repo.update(
      Credential.reconstitute({
        userId: toUserId('user_native'),
        email: EmailAddress.of(EMAIL),
        passwordHash: 'scrypt$65536$8$2$bmV3$bmV3',
        externals: [],
        totp: null,
        createdAt: new Date('2020-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-03T00:00:00.000Z'),
      }),
    )

    const row = await mongo.db.collection(CREDENTIALS).findOne({ _id: 'user_native' as never })
    expect(row?.['createdAt']).toEqual(created)
  })
})
