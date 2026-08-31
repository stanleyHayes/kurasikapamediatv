import { AcceptInvitation, InviteUser, ResendInvitation, RevokeInvitation, type InvitationRepository } from '@kurasikapa/application'
import { NodeSecretGenerator, ScryptPasswordHasher } from '@kurasikapa/adapter-auth'
import { MongoCredentialRepository, MongoInvitationRepository, MongoRoleRepository, MongoUserDirectory } from '@kurasikapa/adapter-mongo'
import { cryptoIds, systemClock } from './ambient'
import { env } from './env'
import { mongoDb } from './mongo'
import { siteUrl } from './origins'
import { resendMailer } from './outbound'

export interface InvitationGraph {
  readonly invitations: InvitationRepository
  readonly invite: InviteUser
  readonly accept: AcceptInvitation
  readonly revoke: RevokeInvitation
  readonly resend: ResendInvitation
}

let instance: InvitationGraph | undefined
export function invitationGraph(): InvitationGraph { instance ??= build(); return instance }

function build(): InvitationGraph {
  const db = mongoDb()
  const invitations = new MongoInvitationRepository(db)
  const secrets = new NodeSecretGenerator()
  const email = resendMailer()
  const publicUrl = siteUrl(env())
  return {
    invitations,
    invite: new InviteUser({ invitations, email, secrets, clock: systemClock, ids: cryptoIds, siteUrl: publicUrl }),
    accept: new AcceptInvitation({ invitations, credentials: new MongoCredentialRepository(db), users: new MongoUserDirectory(db), roles: new MongoRoleRepository(db), passwords: new ScryptPasswordHasher(), secrets, clock: systemClock, ids: cryptoIds }),
    revoke: new RevokeInvitation(invitations),
    resend: new ResendInvitation({ invitations, email, secrets, clock: systemClock, siteUrl: publicUrl }),
  }
}
