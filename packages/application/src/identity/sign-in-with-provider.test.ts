import { beforeEach, describe, expect, it } from 'vitest'
import { Credential, EmailAddress, ProviderAlreadyLinked, userId } from '@kurasikapa/domain'
import {
  FakeClock,
  FakeSecretGenerator,
  FakeTokenSigner,
  InMemoryCredentialRepository,
  InMemoryRefreshTokenRepository,
  SequentialIds,
} from '../testing'
import type { ExternalUser } from '../ports/oauth-provider'
import { SessionIssuer } from './issue-session'
import { ProviderAccountUnusable, SignInWithProvider } from './sign-in-with-provider'

const NOW = new Date('2026-08-14T10:00:00.000Z')
const EMAIL = 'editor@kurasikapa.tv'

let credentials: InMemoryCredentialRepository
let refreshTokens: InMemoryRefreshTokenRepository
let signIn: SignInWithProvider

const identity = (overrides: Partial<ExternalUser> = {}): ExternalUser => ({
  provider: 'google',
  subject: 'google-sub-1',
  email: EMAIL,
  emailVerified: true,
  displayName: 'An Editor',
  ...overrides,
})

const existingAccount = async (): Promise<void> => {
  await credentials.create(
    Credential.register({
      userId: userId('usr_incumbent'),
      email: EmailAddress.of(EMAIL),
      passwordHash: 'hashed:the incumbent passphrase',
      now: NOW,
    }),
  )
}

beforeEach(() => {
  credentials = new InMemoryCredentialRepository()
  refreshTokens = new InMemoryRefreshTokenRepository()

  signIn = new SignInWithProvider({
    credentials,
    sessions: new SessionIssuer({
      tokens: new FakeTokenSigner(),
      refreshTokens,
      secrets: new FakeSecretGenerator(),
      clock: new FakeClock(NOW),
      ids: new SequentialIds(),
    }),
    clock: new FakeClock(NOW),
    ids: new SequentialIds('usr'),
  })
})

describe('a subject we have seen before', () => {
  beforeEach(async () => {
    await credentials.create(
      Credential.fromExternal({
        userId: userId('usr_known'),
        email: EmailAddress.of(EMAIL),
        provider: 'google',
        subject: 'google-sub-1',
        now: NOW,
      }),
    )
  })

  it('signs that account in', async () => {
    await signIn.execute({ external: identity() })

    expect(refreshTokens.all()[0]?.userId).toBe('usr_known')
  })

  it('creates no second account', async () => {
    await signIn.execute({ external: identity() })

    expect(credentials.size).toBe(1)
  })

  it('matches on the subject even when the provider reports a new address', async () => {
    // Providers reassign and re-verify addresses; the subject is the only
    // stable join. Keying on email is how one person signs into another's
    // account after a mailbox changes hands.
    await signIn.execute({ external: identity({ email: 'moved-on@kurasikapa.tv' }) })

    expect(refreshTokens.all()[0]?.userId).toBe('usr_known')
    expect(credentials.size).toBe(1)
  })
})

describe('a new subject on an address nobody holds', () => {
  it('creates the account and signs it in', async () => {
    await signIn.execute({ external: identity() })

    const created = await credentials.findByEmail(EmailAddress.of(EMAIL))
    expect(created?.userId).toBe('usr_1')
    expect(refreshTokens.all()[0]?.userId).toBe('usr_1')
  })

  it('sets no password, because nobody chose one', async () => {
    // An account with a password nobody chose is an account with a password
    // nobody can change.
    await signIn.execute({ external: identity() })

    expect((await credentials.findByEmail(EmailAddress.of(EMAIL)))?.passwordHash).toBeNull()
  })

  it('accepts an UNVERIFIED address, because there is nobody to impersonate', async () => {
    // The asymmetry is the whole design. Creation is safe with an unverified
    // address — the account being created IS the provider identity, and the
    // address is only a way to reach them. Refusing here would lock every
    // Facebook reader out for a risk that does not exist on this path.
    await signIn.execute({ external: identity({ emailVerified: false, provider: 'facebook' }) })

    expect(credentials.size).toBe(1)
    expect(refreshTokens.all()).toHaveLength(1)
  })
})

describe('a new subject on an address that already has an account', () => {
  beforeEach(existingAccount)

  it('links the provider to the incumbent when the address is verified', async () => {
    await signIn.execute({ external: identity() })

    const incumbent = await credentials.findByUserId(userId('usr_incumbent'))
    expect(incumbent?.externalFor('google')?.subject).toBe('google-sub-1')
    expect(credentials.size).toBe(1)
  })

  it('signs in as the incumbent, not as somebody new', async () => {
    await signIn.execute({ external: identity() })

    expect(refreshTokens.all()[0]?.userId).toBe('usr_incumbent')
  })

  it('REFUSES to link when the provider has not verified the address', async () => {
    // This is one-step account takeover otherwise: register a provider account
    // claiming an editor's address, sign in, inherit their roles. Only a
    // provider-asserted verification is enough to believe it is the same
    // person, and Facebook never asserts it.
    await expect(
      signIn.execute({ external: identity({ emailVerified: false, provider: 'facebook' }) }),
    ).rejects.toBeInstanceOf(ProviderAccountUnusable)
  })

  it('writes nothing and issues nothing when it refuses', async () => {
    await expect(
      signIn.execute({ external: identity({ emailVerified: false }) }),
    ).rejects.toThrow()

    const incumbent = await credentials.findByUserId(userId('usr_incumbent'))
    expect(incumbent?.externals).toStrictEqual([])
    expect(refreshTokens.all()).toHaveLength(0)
  })

  it('refuses a SECOND google identity rather than repointing the first', async () => {
    await signIn.execute({ external: identity() })

    // Silently repointing is the takeover this whole path guards against:
    // whoever controls the second Google account would inherit the first one's.
    await expect(
      signIn.execute({ external: identity({ subject: 'google-sub-2' }) }),
    ).rejects.toBeInstanceOf(ProviderAlreadyLinked)
  })
})

describe('a provider that gives us nothing to work with', () => {
  it.each<[string, Partial<ExternalUser>]>([
    ['no email at all', { email: null, provider: 'facebook' }],
    ['an address that is not an address', { email: 'not-an-address' }],
  ])('refuses %s', async (_why, overrides) => {
    // Inventing one — the `{id}@facebook.com` pattern — creates an account
    // keyed to a mailbox nobody owns and nobody can receive a reset at.
    await expect(signIn.execute({ external: identity(overrides) })).rejects.toBeInstanceOf(
      ProviderAccountUnusable,
    )
    expect(credentials.size).toBe(0)
  })

  it('names the provider, so the message can tell the reader what to do instead', async () => {
    // Apple's relay addresses are the case this carries: "your Apple account
    // did not give us an address" is actionable, "sign-in failed" is not.
    await expect(
      signIn.execute({ external: identity({ email: null, provider: 'apple' }) }),
    ).rejects.toMatchObject({ provider: 'apple' })
  })
})
