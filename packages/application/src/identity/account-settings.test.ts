import { Actor, Credential, EmailAddress, userId } from '@kurasikapa/domain'
import { describe, expect, it } from 'vitest'
import { FakeClock, FakePasswordHasher, InMemoryCredentialRepository, InMemoryRefreshTokenRepository, InMemoryUserDirectory } from '../testing'
import { ChangePassword, PasswordChangeRejected } from './change-password'
import { UpdateOwnProfile } from './update-own-profile'

const ID = userId('507f1f77bcf86cd799439011')
const NOW = new Date('2026-08-30T12:00:00Z')
const actor = new Actor(ID, [])

describe('account settings', () => {
  it('updates only the signed-in reader name', async () => {
    const users = new InMemoryUserDirectory([{ id: ID, email: 'reader@example.com', name: 'Old Name', roles: [] }])
    await new UpdateOwnProfile(users).execute({ actor, name: '  Ama   Mensah  ' })
    await expect(users.findById(ID)).resolves.toMatchObject({ name: 'Ama Mensah' })
  })

  it('rejects an unusable display name', async () => {
    await expect(new UpdateOwnProfile(new InMemoryUserDirectory()).execute({ actor, name: 'A' })).rejects.toThrow(/between 2 and 80/u)
  })

  it('changes a verified password', async () => {
    const credentials = new InMemoryCredentialRepository()
    const passwords = new FakePasswordHasher()
    await credentials.create(Credential.register({ userId: ID, email: EmailAddress.of('reader@example.com'), passwordHash: await passwords.hash('old-password-value'), now: NOW }))
    const useCase = new ChangePassword({ credentials, passwords, refreshTokens: new InMemoryRefreshTokenRepository(), clock: new FakeClock(NOW) })
    await useCase.execute({ actor, currentPassword: 'old-password-value', newPassword: 'a much safer new passphrase' })
    const changed = await credentials.findByUserId(ID)
    await expect(passwords.verify('a much safer new passphrase', changed?.passwordHash ?? '')).resolves.toBe(true)
  })

  it('does not change a password without the current secret', async () => {
    const credentials = new InMemoryCredentialRepository()
    const passwords = new FakePasswordHasher()
    await credentials.create(Credential.register({ userId: ID, email: EmailAddress.of('reader@example.com'), passwordHash: await passwords.hash('old-password-value'), now: NOW }))
    const useCase = new ChangePassword({ credentials, passwords, refreshTokens: new InMemoryRefreshTokenRepository(), clock: new FakeClock(NOW) })
    await expect(useCase.execute({ actor, currentPassword: 'wrong-password', newPassword: 'a much safer new passphrase' })).rejects.toBeInstanceOf(PasswordChangeRejected)
  })
})
