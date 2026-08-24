import { Credential, EmailAddress, TotpAlreadyEnrolled, userId } from '@kurasikapa/domain'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  FakeClock,
  FakePasswordHasher,
  FakeSecretGenerator,
  FakeTotp,
  InMemoryCredentialRepository,
} from '../testing'
import { EnrolSecondFactor, EnrolmentRefused } from './enrol-second-factor'

const NOW = new Date('2026-08-24T10:00:00.000Z')
const USER = userId('u1')
const PASSWORD = 'correct horse battery staple'

let credentials: InMemoryCredentialRepository
let enrol: EnrolSecondFactor

const account = (): Credential =>
  Credential.reconstitute({
    userId: USER,
    email: EmailAddress.of('editor@kurasikapa.tv'),
    passwordHash: `hashed:${PASSWORD}`,
    externals: [],
    totp: null,
    createdAt: NOW,
    updatedAt: NOW,
  })

beforeEach(async () => {
  credentials = new InMemoryCredentialRepository()
  await credentials.create(account())

  enrol = new EnrolSecondFactor({
    credentials,
    passwords: new FakePasswordHasher(),
    totp: new FakeTotp(),
    secrets: new FakeSecretGenerator(),
    clock: new FakeClock(NOW),
    issuer: 'Kurasikapa Media',
  })
})

describe('EnrolSecondFactor', () => {
  it('turns the factor on and returns something to scan', async () => {
    const result = await enrol.execute({ userId: USER, password: PASSWORD })

    expect(result.provisioningUri).toBe('otpauth://totp/fake')
    expect((await credentials.findByUserId(USER))?.requiresSecondFactor).toBe(true)
  })

  it('issues a full set of recovery codes', async () => {
    const { recoveryCodes } = await enrol.execute({ userId: USER, password: PASSWORD })

    expect(recoveryCodes).toHaveLength(10)
    expect(new Set(recoveryCodes).size).toBe(10)
  })

  it('stores only hashes of the recovery codes', async () => {
    // A database leak must not hand over a working way past the second factor.
    const { recoveryCodes } = await enrol.execute({ userId: USER, password: PASSWORD })
    const stored = (await credentials.findByUserId(USER))?.totp?.recoveryCodeHashes ?? []

    for (const code of recoveryCodes) {
      expect(stored).not.toContain(code)
      expect(stored).toContain(`sha256(${code})`)
    }
  })

  it('refuses a wrong password, even though the caller is signed in', async () => {
    // A signed-in session is not enough. An unattended browser could otherwise
    // enrol an attacker's authenticator and lock the owner out of their own
    // account.
    await expect(enrol.execute({ userId: USER, password: 'wrong' })).rejects.toBeInstanceOf(
      EnrolmentRefused,
    )
    expect((await credentials.findByUserId(USER))?.requiresSecondFactor).toBe(false)
  })

  it('gives an unknown user the identical refusal', async () => {
    await expect(
      enrol.execute({ userId: userId('nobody'), password: PASSWORD }),
    ).rejects.toBeInstanceOf(EnrolmentRefused)
  })

  it('refuses a provider-only account, which has no password to re-check', async () => {
    const noPassword = new InMemoryCredentialRepository()
    await noPassword.create(
      Credential.reconstitute({
        userId: USER,
        email: EmailAddress.of('reader@kurasikapa.tv'),
        passwordHash: null,
        externals: [{ provider: 'google', subject: 'g1', linkedAt: NOW }],
        totp: null,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    )

    const forProvider = new EnrolSecondFactor({
      credentials: noPassword,
      passwords: new FakePasswordHasher(),
      totp: new FakeTotp(),
      secrets: new FakeSecretGenerator(),
      clock: new FakeClock(NOW),
      issuer: 'Kurasikapa Media',
    })

    await expect(forProvider.execute({ userId: USER, password: '' })).rejects.toBeInstanceOf(
      EnrolmentRefused,
    )
  })

  it('refuses to enrol twice, which would strand the printed recovery codes', async () => {
    await enrol.execute({ userId: USER, password: PASSWORD })

    await expect(enrol.execute({ userId: USER, password: PASSWORD })).rejects.toBeInstanceOf(
      TotpAlreadyEnrolled,
    )
  })
})
