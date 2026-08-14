import { EmailAlreadyRegistered, type CredentialRepository } from '@kurasikapa/application'
import {
  Credential,
  EmailAddress,
  userId as toUserId,
  type ExternalProvider,
  type UserId,
} from '@kurasikapa/domain'
import { MongoServerError, type Collection, type Db } from 'mongodb'
import { CREDENTIALS, type CredentialDocument } from './documents'

/** MongoDB's code for a unique-index violation. */
const DUPLICATE_KEY = 11_000

export class MongoCredentialRepository implements CredentialRepository {
  private readonly rows: Collection<CredentialDocument>

  constructor(db: Db) {
    this.rows = db.collection<CredentialDocument>(CREDENTIALS)
  }

  async findByEmail(email: EmailAddress): Promise<Credential | null> {
    return this.one({ email: email.value })
  }

  async findByUserId(id: UserId): Promise<Credential | null> {
    return this.one({ _id: id })
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
      },
    )
  }

  private async one(filter: Record<string, unknown>): Promise<Credential | null> {
    const doc = await this.rows.findOne(filter)

    return doc === null ? null : toDomain(doc)
  }
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
