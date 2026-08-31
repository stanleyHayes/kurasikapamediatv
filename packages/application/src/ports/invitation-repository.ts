import type { Role, UserId } from '@kurasikapa/domain'

export type InvitationState = 'pending' | 'accepted' | 'revoked'

export interface InvitationRecord {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly roles: readonly Role[]
  readonly tokenHash: string
  readonly invitedBy: UserId
  readonly createdAt: Date
  readonly expiresAt: Date
  readonly state: InvitationState
}

export class PendingInvitationExists extends Error {
  constructor(readonly email: string) { super(`A pending invitation already exists for ${email}`); this.name = 'PendingInvitationExists' }
}

export interface InvitationRepository {
  create(invitation: InvitationRecord): Promise<void>
  findByTokenHash(tokenHash: string): Promise<InvitationRecord | null>
  findPendingByEmail(email: string): Promise<InvitationRecord | null>
  list(): Promise<readonly InvitationRecord[]>
  replace(invitation: InvitationRecord): Promise<void>
}
