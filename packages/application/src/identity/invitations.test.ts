import { Actor, userId } from '@kurasikapa/domain'
import { describe, expect, it } from 'vitest'
import { FakeClock, SequentialIds } from '../testing/fakes'
import { RecordingEmail } from '../testing/fake-email'
import { FakePasswordHasher, FakeSecretGenerator, InMemoryCredentialRepository } from '../testing/auth-fakes'
import { InMemoryRoleRepository } from '../testing/in-memory-role-repository'
import { InMemoryUserDirectory } from '../testing/in-memory-user-directory'
import type { InvitationRecord, InvitationRepository } from '../ports/invitation-repository'
import { AcceptInvitation } from './accept-invitation'
import { InviteUser } from './invite-user'

const NOW = new Date('2026-08-31T10:00:00.000Z')

class InMemoryInvitations implements InvitationRepository {
  readonly rows: InvitationRecord[] = []
  create(row: InvitationRecord): Promise<void> { this.rows.push(row); return Promise.resolve() }
  findByTokenHash(hash: string): Promise<InvitationRecord | null> { return Promise.resolve(this.rows.find((row) => row.tokenHash === hash) ?? null) }
  findPendingByEmail(email: string): Promise<InvitationRecord | null> { return Promise.resolve(this.rows.find((row) => row.email === email && row.state === 'pending') ?? null) }
  list(): Promise<readonly InvitationRecord[]> { return Promise.resolve(this.rows) }
  replace(row: InvitationRecord): Promise<void> { const index = this.rows.findIndex((item) => item.id === row.id); this.rows[index] = row; return Promise.resolve() }
}

describe('team invitations', () => {
  it('stores only a token hash and sends a seven-day role-specific invitation', async () => {
    const invitations = new InMemoryInvitations()
    const email = new RecordingEmail()
    const useCase = new InviteUser({ invitations, email, secrets: new FakeSecretGenerator(), clock: new FakeClock(NOW), ids: new SequentialIds('invite'), siteUrl: 'https://example.com' })
    const result = await useCase.execute({ actor: new Actor(userId('admin'), ['super_admin']), email: 'Editor@Example.com', name: 'Ama', roles: ['editor'] })
    expect(result.invitation).toMatchObject({ email: 'editor@example.com', roles: ['editor'], state: 'pending', tokenHash: 'sha256(secret-1)' })
    expect(result.inviteUrl).toContain('token=secret-1')
    expect(result.invitation.expiresAt.getTime() - NOW.getTime()).toBe(7 * 24 * 60 * 60 * 1_000)
    expect(email.sent).toHaveLength(1)
  })

  it('accepts once, creates the account, assigns roles and consumes the invitation', async () => {
    const invitations = new InMemoryInvitations()
    invitations.rows.push({ id: 'invite_1', email: 'ama@example.com', name: 'Ama', roles: ['journalist'], tokenHash: 'sha256(secret-1)', invitedBy: userId('admin'), createdAt: NOW, expiresAt: new Date(NOW.getTime() + 60_000), state: 'pending' })
    const credentials = new InMemoryCredentialRepository()
    const users = new InMemoryUserDirectory()
    const roles = new InMemoryRoleRepository()
    const useCase = new AcceptInvitation({ invitations, credentials, users, roles, passwords: new FakePasswordHasher(), secrets: new FakeSecretGenerator(), clock: new FakeClock(NOW), ids: new SequentialIds('user') })
    await useCase.execute({ token: 'secret-1', password: 'Strong newsroom passphrase 42!' })
    expect(credentials.size).toBe(1)
    expect((await users.list({ limit: 10 })).items[0]?.name).toBe('Ama')
    expect(await roles.rolesFor(userId('user_1'))).toEqual(['journalist'])
    expect(invitations.rows[0]?.state).toBe('accepted')
    await expect(useCase.execute({ token: 'secret-1', password: 'Strong newsroom passphrase 42!' })).rejects.toThrow('invalid, expired, or has already been used')
  })
})
