import { beforeEach, describe, expect, it } from 'vitest'
import { Credential, EmailAddress, userId } from '@kurasikapa/domain'
import {
  AllowingRateLimiter,
  FakeClock,
  FakePasswordHasher,
  FakeSecretGenerator,
  FakeTokenSigner,
  InMemoryCredentialRepository,
  InMemoryRefreshTokenRepository,
  SequentialIds,
} from '../testing'
import { SessionIssuer } from './issue-session'
import { SignInFailed, SignInWithPassword, TooManyAttempts } from './sign-in-with-password'

const NOW = new Date('2026-08-14T10:00:00.000Z')
const EMAIL = 'editor@kurasikapa.tv'
const PASSWORD = 'correct horse battery staple'

let credentials: InMemoryCredentialRepository
let refreshTokens: InMemoryRefreshTokenRepository
let limiter: AllowingRateLimiter
let passwords: FakePasswordHasher
let signIn: SignInWithPassword

beforeEach(async () => {
  credentials = new InMemoryCredentialRepository()
  refreshTokens = new InMemoryRefreshTokenRepository()
  limiter = new AllowingRateLimiter()
  passwords = new FakePasswordHasher()

  const clock = new FakeClock(NOW)
  const sessions = new SessionIssuer({
    tokens: new FakeTokenSigner(),
    refreshTokens,
    secrets: new FakeSecretGenerator(),
    clock,
    ids: new SequentialIds(),
  })

  signIn = new SignInWithPassword({
    credentials,
    passwords,
    tokens: new FakeTokenSigner(),
    sessions,
    limiter,
    clock,
  })

  await credentials.create(
    Credential.register({
      userId: userId('u1'),
      email: EmailAddress.of(EMAIL),
      passwordHash: await passwords.hash(PASSWORD),
      now: NOW,
    }),
  )
})

const attempt = (email: string, password: string): Promise<unknown> =>
  signIn.execute({ email, password, callerKey: 'ip-1' })

describe('a correct password', () => {
  it('issues a session', async () => {
    const outcome = await signIn.execute({ email: EMAIL, password: PASSWORD, callerKey: 'ip-1' })

    expect(outcome.kind).toBe('signed-in')
  })

  it('stores a refresh token that can be revoked', async () => {
    await attempt(EMAIL, PASSWORD)

    // The stored row is what makes a thirty-day session revocable. Only the
    // hash is kept — a database leak must not hand over live sessions.
    const [row] = refreshTokens.all()
    expect(row?.state).toBe('active')
    expect(row?.tokenHash).toMatch(/^sha256\(/u)
  })

  it('is case- and whitespace-insensitive about the address', async () => {
    const outcome = await signIn.execute({
      email: '  EDITOR@Kurasikapa.TV ',
      password: PASSWORD,
      callerKey: 'ip-1',
    })

    expect(outcome.kind).toBe('signed-in')
  })
})

describe('failure says the same thing every time', () => {
  it.each([
    ['a wrong password', EMAIL, 'not the password at all'],
    ['an unknown address', 'nobody@kurasikapa.tv', PASSWORD],
    ['an address that is not an address', 'not-an-email', PASSWORD],
    ['an empty password', EMAIL, ''],
  ])('%s', async (_why, email, password) => {
    // One message for every case. Anything more specific is an oracle that
    // tells a stranger which addresses have accounts — and on a news site the
    // account list overlaps the source list.
    await expect(attempt(email, password)).rejects.toBeInstanceOf(SignInFailed)
  })

  it('refuses a provider-only account without hinting that it exists', async () => {
    await credentials.create(
      Credential.fromExternal({
        userId: userId('u2'),
        email: EmailAddress.of('google-only@kurasikapa.tv'),
        provider: 'google',
        subject: 'sub-1',
        now: NOW,
      }),
    )

    await expect(attempt('google-only@kurasikapa.tv', PASSWORD)).rejects.toBeInstanceOf(
      SignInFailed,
    )
  })

  it('issues no session on failure', async () => {
    await expect(attempt(EMAIL, 'wrong')).rejects.toThrow()

    expect(refreshTokens.all()).toHaveLength(0)
  })
})

describe('rate limiting', () => {
  it('counts every attempt, including the ones that fail', async () => {
    await attempt(EMAIL, 'wrong').catch(() => undefined)

    expect(limiter.consumed).toStrictEqual(['signin:ip-1'])
  })

  it('refuses once the limiter says so, before touching the password', async () => {
    limiter.deny()

    // Checked FIRST: an attacker must not be able to spend our CPU on a slow
    // hash for every guess after they have already been throttled.
    await expect(attempt(EMAIL, PASSWORD)).rejects.toBeInstanceOf(TooManyAttempts)
  })

  it('tells the caller how long to wait', async () => {
    limiter.deny()

    await expect(attempt(EMAIL, PASSWORD)).rejects.toMatchObject({ retryAfterSeconds: 42 })
  })
})

describe('two-factor accounts', () => {
  beforeEach(async () => {
    const existing = await credentials.findByUserId(userId('u1'))
    await credentials.update(existing!.enrolTotp('SECRET', ['h1'], NOW))
  })

  it('returns a challenge instead of a session', async () => {
    const outcome = await signIn.execute({ email: EMAIL, password: PASSWORD, callerKey: 'ip-1' })

    expect(outcome.kind).toBe('second-factor-required')
  })

  it('issues NO refresh token until the second factor is presented', async () => {
    await attempt(EMAIL, PASSWORD)

    // If a session existed at this point, knowing the password would be enough
    // and the second factor would be decorative.
    expect(refreshTokens.all()).toHaveLength(0)
  })

  it('mints a challenge, not an access token', async () => {
    const outcome = await signIn.execute({ email: EMAIL, password: PASSWORD, callerKey: 'ip-1' })

    expect(outcome).toMatchObject({ kind: 'second-factor-required' })
    if (outcome.kind !== 'second-factor-required') return
    expect(JSON.parse(outcome.challengeToken.slice('signed.'.length))).toMatchObject({
      kind: 'challenge',
    })
  })
})

describe('hash upgrades', () => {
  it('rehashes a password stored with a weaker cost, on successful sign-in', async () => {
    await credentials.update(
      Credential.register({
        userId: userId('u1'),
        email: EmailAddress.of(EMAIL),
        passwordHash: `weak:${PASSWORD}`,
        now: NOW,
      }),
    )

    await attempt(EMAIL, PASSWORD)

    // The only moment the plaintext exists is the only moment an upgrade is
    // possible. Without this, raising the cost protects nobody who already has
    // an account — including every row migrated from Better Auth.
    const after = await credentials.findByUserId(userId('u1'))
    expect(after?.passwordHash).toBe(`hashed:${PASSWORD}`)
  })

  it('leaves a current hash alone', async () => {
    await attempt(EMAIL, PASSWORD)

    expect((await credentials.findByUserId(userId('u1')))?.passwordHash).toBe(
      `hashed:${PASSWORD}`,
    )
  })
})
