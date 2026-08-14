import type { NewRefreshToken, RefreshTokenRepository } from '@kurasikapa/application'
import { userId as toUserId, type RefreshTokenRecord, type UserId } from '@kurasikapa/domain'
import type { Collection, Db } from 'mongodb'
import { REFRESH_TOKENS, type RefreshTokenDocument } from './documents'

export class MongoRefreshTokenRepository implements RefreshTokenRepository {
  private readonly rows: Collection<RefreshTokenDocument>

  constructor(db: Db) {
    this.rows = db.collection<RefreshTokenDocument>(REFRESH_TOKENS)
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const doc = await this.rows.findOne({ tokenHash })

    return doc === null ? null : toDomain(doc)
  }

  async create(token: NewRefreshToken): Promise<void> {
    await this.rows.insertOne({ ...toDocument(token), state: 'active' })
  }

  /**
   * Spends one token and issues its replacement in a single step.
   *
   * The `state: 'active'` in the filter is the whole security property, and it
   * is why this is a conditional update rather than a read followed by a
   * write. Two concurrent refreshes with the same token both read `active`,
   * both mint a replacement, and reuse detection never fires — which is
   * precisely the case it exists to catch. Here the second update matches
   * nothing and throws.
   *
   * Not wrapped in a transaction on purpose: the guarded update is already
   * atomic, and requiring a transaction would make refresh depend on a replica
   * set, which local development does not always have.
   */
  async rotate(spentId: string, replacement: NewRefreshToken): Promise<void> {
    const spent = await this.rows.updateOne(
      { _id: spentId, state: 'active' },
      { $set: { state: 'rotated' } },
    )

    if (spent.matchedCount === 0) {
      throw new Error(`Refresh token ${spentId} was not active and cannot be rotated`)
    }

    await this.rows.insertOne({ ...toDocument(replacement), state: 'active' })
  }

  /**
   * Revokes the family, including tokens already spent.
   *
   * `rotated` rows are deliberately included: leaving them means a later replay
   * of an old token still reads as reuse rather than as a plain unknown token,
   * and the distinction is what a security log needs.
   */
  async revokeFamily(sessionId: string): Promise<void> {
    await this.rows.updateMany(
      { sessionId, state: { $ne: 'revoked' } },
      { $set: { state: 'revoked' } },
    )
  }

  async revokeAllForUser(userId: UserId): Promise<void> {
    await this.rows.updateMany(
      { userId, state: { $ne: 'revoked' } },
      { $set: { state: 'revoked' } },
    )
  }
}

const toDocument = (token: NewRefreshToken): Omit<RefreshTokenDocument, 'state'> => ({
  _id: token.id,
  sessionId: token.sessionId,
  userId: token.userId,
  tokenHash: token.tokenHash,
  expiresAt: token.expiresAt,
  createdAt: token.createdAt,
})

const toDomain = (doc: RefreshTokenDocument): RefreshTokenRecord => ({
  id: doc._id,
  sessionId: doc.sessionId,
  userId: toUserId(doc.userId),
  tokenHash: doc.tokenHash,
  state: doc.state,
  expiresAt: doc.expiresAt,
  createdAt: doc.createdAt,
})
