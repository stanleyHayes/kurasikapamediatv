import { EmailAlreadyRegistered, type CredentialRepository } from '@kurasikapa/application'
import {
  Credential,
  EmailAddress,
  userId as toUserId,
  type ExternalProvider,
  type UserId,
} from '@kurasikapa/domain'
import { MongoServerError, ObjectId, type Collection, type Db } from 'mongodb'
import {
  CREDENTIALS,
  LEGACY_ACCOUNTS,
  LEGACY_TWO_FACTOR,
  LEGACY_USERS,
  type CredentialDocument,
} from './documents'

/** MongoDB's code for a unique-index violation. */
const DUPLICATE_KEY = 11_000

export class MongoCredentialRepository implements CredentialRepository {
  private readonly rows: Collection<CredentialDocument>
  private readonly db: Db

  constructor(db: Db) {
    this.db = db
    this.rows = db.collection<CredentialDocument>(CREDENTIALS)
  }

  /**
   * Native row first, then the Better Auth row it will replace.
   *
   * Every account that predates KUR-66 lives in `user`/`account`, so without
   * this fallback `findByEmail` returns null for all of them and the cutover
   * reads as "those details did not match an account" to every existing user.
   *
   * Nothing is written here. `SignInWithPassword` already rehashes and calls
   * `update` when `needsRehash` is true — which it is for a Better Auth hash —
   * so the native row appears as a side effect of the first successful
   * sign-in, and this fallback stops being consulted for that account.
   */
  async findByEmail(email: EmailAddress): Promise<Credential | null> {
    return (await this.one({ email: email.value })) ?? this.legacy({ email: email.value })
  }

  async findByUserId(id: UserId): Promise<Credential | null> {
    return (await this.one({ _id: id })) ?? this.legacyByUserId(id)
  }

  /**
   * Matches the provider's immutable subject, never the email it reported.
   *
   * Providers reassign and re-verify addresses; the subject is the only stable
   * join. Keying on email here is how one person signs into another's account.
   */
  async findByExternal(provider: ExternalProvider, subject: string): Promise<Credential | null> {
    return this.one({ externals: { $elemMatch: { provider, subject } } })
  }

  /**
   * Inserts, and lets the UNIQUE INDEX decide whether the email was taken.
   *
   * Deliberately not a find-then-insert: two concurrent sign-ups both read
   * "free" and both insert, and the second account silently shadows the first.
   * The index is the only arbiter that holds under concurrency.
   */
  async create(credential: Credential): Promise<void> {
    try {
      await this.rows.insertOne(toDocument(credential))
    } catch (error) {
      if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) {
        throw new EmailAlreadyRegistered(credential.email.value)
      }
      throw error
    }
  }

  async update(credential: Credential): Promise<void> {
    const doc = toDocument(credential)

    await this.rows.updateOne(
      { _id: doc._id },
      {
        $set: {
          email: doc.email,
          passwordHash: doc.passwordHash,
          externals: doc.externals,
          totp: doc.totp,
          updatedAt: doc.updatedAt,
        },
        // Only on insert, so a migration never backdates an existing row.
        $setOnInsert: { createdAt: doc.createdAt },
      },
      // Upsert, because the row being updated may not exist yet: a Better Auth
      // account reaches `update` through the rehash in SignInWithPassword, and
      // that call IS the migration. Without this the rehash writes nothing,
      // the fallback is consulted forever, and the legacy hash never dies.
      { upsert: true },
    )
  }

  private async one(filter: Record<string, unknown>): Promise<Credential | null> {
    const doc = await this.rows.findOne(filter)

    return doc === null ? null : toDomain(doc)
  }

  private async legacyByUserId(id: UserId): Promise<Credential | null> {
    // Better Auth writes `user._id` as an ObjectId; everything downstream of
    // it uses the hex string. Match on the hex, which is what a UserId is.
    const users = this.db.collection(LEGACY_USERS)
    const found = await users.findOne({
      $expr: { $eq: [{ $toString: '$_id' }, id] },
    })

    return found === null ? null : this.fromLegacy(found)
  }

  private async legacy(filter: Record<string, unknown>): Promise<Credential | null> {
    const found = await this.db.collection(LEGACY_USERS).findOne(filter)

    return found === null ? null : this.fromLegacy(found)
  }

  /**
   * Builds a Credential from the incumbent's two rows.
   *
   * Returns null — a failed sign-in — rather than a credential when the
   * account has Better Auth two-factor enrolled. Its secret lives in a schema
   * this stack does not read, so migrating the account would hand back a
   * credential with `totp: null` and sign the user in on a password alone.
   * Silently removing someone's second factor during a migration they did not
   * ask for is the worst outcome available here; refusing is recoverable.
   */
  private async fromLegacy(user: Record<string, unknown>): Promise<Credential | null> {
    const id = String(user['_id'])
    const email = user['email']
    if (typeof email !== 'string' || email === '') return null

    const owner = eitherIdForm(id)

    const enrolled = await this.db
      .collection(LEGACY_TWO_FACTOR)
      .countDocuments({ userId: owner }, { limit: 1 })
    if (enrolled > 0) return null

    const account = await this.db.collection(LEGACY_ACCOUNTS).findOne({
      userId: owner,
      providerId: 'credential',
    })

    const password: unknown = account?.['password']
    if (typeof password !== 'string' || password === '') return null

    const created = user['createdAt']

    return Credential.reconstitute({
      userId: toUserId(id),
      email: EmailAddress.of(email),
      passwordHash: password,
      // Provider links stay with Better Auth until it is retired. Copying them
      // would claim this stack can complete an OAuth sign-in for an account it
      // has never seen a subject for.
      externals: [],
      totp: null,
      createdAt: created instanceof Date ? created : EPOCH,
      updatedAt: created instanceof Date ? created : EPOCH,
    })
  }
}

/** Only ever used for a legacy row with no timestamp; never written back. */
const EPOCH = new Date(0)

/**
 * Matches a Better Auth `userId` however it was stored.
 *
 * Its Mongo adapter writes `user._id` as an ObjectId, and whether the foreign
 * keys that point at it are ObjectIds or hex strings is a detail of the adapter
 * version that wrote them — a database can hold both, from different releases.
 * Matching one form finds nothing for the other, and "nothing" here reads as
 * "those details did not match an account" to someone whose password is right.
 */
function eitherIdForm(id: string): { $in: (string | ObjectId)[] } {
  const forms: (string | ObjectId)[] = [id]

  if (ObjectId.isValid(id)) forms.push(new ObjectId(id))

  return { $in: forms }
}

function toDocument(credential: Credential): CredentialDocument {
  const props = credential.snapshot()

  return {
    _id: props.userId,
    email: props.email.value,
    passwordHash: props.passwordHash,
    externals: props.externals.map((e) => ({
      provider: e.provider,
      subject: e.subject,
      linkedAt: e.linkedAt,
    })),
    totp:
      props.totp === null
        ? null
        : {
            secret: props.totp.secret,
            lastUsedCounter: props.totp.lastUsedCounter,
            recoveryCodeHashes: [...props.totp.recoveryCodeHashes],
            enrolledAt: props.totp.enrolledAt,
          },
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
  }
}

function toDomain(doc: CredentialDocument): Credential {
  return Credential.reconstitute({
    userId: toUserId(doc._id),
    // Already normalised on the way in. Re-parsing rather than casting means a
    // row hand-edited to an impossible address fails loudly here, not later.
    email: EmailAddress.of(doc.email),
    passwordHash: doc.passwordHash,
    externals: doc.externals.map((e) => ({
      provider: e.provider,
      subject: e.subject,
      linkedAt: e.linkedAt,
    })),
    totp:
      doc.totp === null
        ? null
        : {
            secret: doc.totp.secret,
            lastUsedCounter: doc.totp.lastUsedCounter,
            recoveryCodeHashes: doc.totp.recoveryCodeHashes,
            enrolledAt: doc.totp.enrolledAt,
          },
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  })
}
