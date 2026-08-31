import { PendingInvitationExists, type InvitationRecord, type InvitationRepository } from '@kurasikapa/application'
import type { Role } from '@kurasikapa/domain'
import type { Collection, Db } from 'mongodb'
import { INVITATIONS, type InvitationDocument } from './documents'

export class MongoInvitationRepository implements InvitationRepository {
  private readonly rows: Collection<InvitationDocument>
  constructor(db: Db) { this.rows = db.collection<InvitationDocument>(INVITATIONS) }

  async create(invitation: InvitationRecord): Promise<void> {
    if (await this.findPendingByEmail(invitation.email) !== null) throw new PendingInvitationExists(invitation.email)
    await this.rows.insertOne(toDocument(invitation))
  }
  async findByTokenHash(tokenHash: string): Promise<InvitationRecord | null> {
    const found = await this.rows.findOne({ tokenHash }); return found === null ? null : toRecord(found)
  }
  async findPendingByEmail(email: string): Promise<InvitationRecord | null> {
    const found = await this.rows.findOne({ email, state: 'pending' }); return found === null ? null : toRecord(found)
  }
  async list(): Promise<readonly InvitationRecord[]> {
    return (await this.rows.find().sort({ createdAt: -1 }).limit(200).toArray()).map(toRecord)
  }
  async replace(invitation: InvitationRecord): Promise<void> {
    await this.rows.replaceOne({ _id: invitation.id }, toDocument(invitation), { upsert: false })
  }
}

const toDocument = (row: InvitationRecord): InvitationDocument => ({ _id: row.id, email: row.email, name: row.name, roles: [...row.roles], tokenHash: row.tokenHash, invitedBy: row.invitedBy, createdAt: row.createdAt, expiresAt: row.expiresAt, state: row.state })
const toRecord = (row: InvitationDocument): InvitationRecord => ({ id: row._id, email: row.email, name: row.name, roles: row.roles as Role[], tokenHash: row.tokenHash, invitedBy: row.invitedBy as InvitationRecord['invitedBy'], createdAt: row.createdAt, expiresAt: row.expiresAt, state: row.state as InvitationRecord['state'] })
