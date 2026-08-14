import { describe, expect, it } from 'vitest'
import { userId } from '../shared/ids'
import { EmailAddress } from './email-address'
import {
  Credential,
  NoWayToSignIn,
  ProviderAlreadyLinked,
  TotpAlreadyEnrolled,
  TotpNotEnrolled,
} from './credential'

const NOW = new Date('2026-08-14T10:00:00.000Z')
const LATER = new Date('2026-08-14T11:00:00.000Z')
const EMAIL = EmailAddress.of('editor@kurasikapa.tv')

const withPassword = (): Credential =>
  Credential.register({ userId: userId('u1'), email: EMAIL, passwordHash: 'hash', now: NOW })

const withGoogle = (): Credential =>
  Credential.fromExternal({
    userId: userId('u1'),
    email: EMAIL,
    provider: 'google',
    subject: 'google-sub-1',
    now: NOW,
  })

describe('register', () => {
  it('starts with a password and nothing else', () => {
    const credential = withPassword()

    expect(credential.hasPassword).toBe(true)
    expect(credential.externals).toStrictEqual([])
    expect(credential.requiresSecondFactor).toBe(false)
  })
})

describe('fromExternal', () => {
  it('sets NO password', () => {
    // An account with a password nobody chose is an account with a password
    // nobody can change — and one an attacker might guess.
    expect(withGoogle().hasPassword).toBe(false)
  })

  it('records the provider subject, not the email', () => {
    // Emails change and get reassigned; the subject is immutable. Keying on
    // email is how one person ends up in another person's account.
    expect(withGoogle().externalFor('google')?.subject).toBe('google-sub-1')
  })
})

describe('linking a provider', () => {
  it('adds an identity to a password account', () => {
    const linked = withPassword().linkExternal('google', 'sub-1', LATER)

    expect(linked.externalFor('google')?.subject).toBe('sub-1')
    expect(linked.hasPassword).toBe(true)
  })

  it('refuses a second identity for the same provider', () => {
    // Silently replacing the first would let whoever controls the second
    // identity take the account over.
    expect(() => withGoogle().linkExternal('google', 'other-sub', LATER)).toThrow(
      ProviderAlreadyLinked,
    )
  })

  it('allows different providers side by side', () => {
    const both = withGoogle().linkExternal('apple', 'apple-sub', LATER)

    expect(both.externals).toHaveLength(2)
  })

  it('leaves the original untouched', () => {
    const original = withPassword()
    original.linkExternal('google', 'sub-1', LATER)

    expect(original.externals).toStrictEqual([])
  })
})

describe('keeping a way in', () => {
  it('refuses to remove the only password when there is no provider', () => {
    expect(() => withPassword().removePassword(LATER)).toThrow(NoWayToSignIn)
  })

  it('allows removing the password once a provider is linked', () => {
    const linked = withPassword().linkExternal('google', 'sub-1', LATER)

    expect(() => linked.removePassword(LATER)).not.toThrow()
  })

  it('refuses to unlink the only provider when there is no password', () => {
    expect(() => withGoogle().unlinkExternal('google', LATER)).toThrow(NoWayToSignIn)
  })

  it('allows unlinking once a password is set', () => {
    const both = withGoogle().setPassword('hash', LATER)

    expect(() => both.unlinkExternal('google', LATER)).not.toThrow()
  })

  it('refuses to strip the last of several providers', () => {
    const two = withGoogle().linkExternal('apple', 'apple-sub', LATER)
    const one = two.unlinkExternal('google', LATER)

    expect(() => one.unlinkExternal('apple', LATER)).toThrow(NoWayToSignIn)
  })
})

describe('two-factor enrolment', () => {
  const enrolled = (): Credential => withPassword().enrolTotp('SECRET', ['h1', 'h2'], LATER)

  it('records the secret and the unused recovery codes', () => {
    const credential = enrolled()

    expect(credential.requiresSecondFactor).toBe(true)
    expect(credential.totp?.secret).toBe('SECRET')
    expect(credential.totp?.recoveryCodeHashes).toStrictEqual(['h1', 'h2'])
  })

  it('starts with no used counter, so the first code of any step works', () => {
    expect(enrolled().totp?.lastUsedCounter).toBeNull()
  })

  it('refuses to enrol twice', () => {
    // Re-enrolling would silently invalidate the authenticator the reader
    // already set up, and mint recovery codes they never saw.
    expect(() => enrolled().enrolTotp('OTHER', [], LATER)).toThrow(TotpAlreadyEnrolled)
  })

  it('records the step a code was accepted at', () => {
    expect(enrolled().recordTotpUse(42, LATER).totp?.lastUsedCounter).toBe(42)
  })

  it('burns a recovery code when it is used', () => {
    const after = enrolled().consumeRecoveryCode('h1', LATER)

    expect(after.totp?.recoveryCodeHashes).toStrictEqual(['h2'])
  })

  it('refuses TOTP operations on an account without it', () => {
    const plain = withPassword()

    expect(() => plain.recordTotpUse(1, LATER)).toThrow(TotpNotEnrolled)
    expect(() => plain.consumeRecoveryCode('h1', LATER)).toThrow(TotpNotEnrolled)
    expect(() => plain.disableTotp(LATER)).toThrow(TotpNotEnrolled)
  })

  it('can be turned off', () => {
    expect(enrolled().disableTotp(LATER).requiresSecondFactor).toBe(false)
  })
})

describe('the password hash', () => {
  it('is reachable for verification but is not part of any display shape', () => {
    // It lives on the credential, never on the user the roles screen renders —
    // which is the reason these are two objects and not one.
    expect(withPassword().passwordHash).toBe('hash')
    expect(Object.keys(withPassword().snapshot())).not.toContain('name')
  })
})
