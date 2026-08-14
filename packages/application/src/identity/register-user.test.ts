import { beforeEach, describe, expect, it } from 'vitest'
import {
  Credential,
  EmailAddress,
  InvalidEmailAddress,
  PasswordContainsIdentity,
  PasswordTooLong,
  PasswordTooShort,
  userId,
} from '@kurasikapa/domain'
import {
  AllowingRateLimiter,
  CREDENTIAL_STORE_UNAVAILABLE,
  ExplodingCredentialRepository,
  FakeClock,
  FakePasswordHasher,
  InMemoryCredentialRepository,
  SequentialIds,
} from '../testing'
import { RegisterUser, RegistrationThrottled } from './register-user'

const NOW = new Date('2026-08-14T10:00:00.000Z')
const EMAIL = 'newcomer@kurasikapa.tv'
const PASSWORD = 'correct horse battery staple'

let credentials: InMemoryCredentialRepository
let limiter: AllowingRateLimiter
let register: RegisterUser

const registerWith = (store: InMemoryCredentialRepository): RegisterUser =>
  new RegisterUser({
    credentials: store,
    passwords: new FakePasswordHasher(),
    limiter,
    clock: new FakeClock(NOW),
    ids: new SequentialIds('usr'),
  })

beforeEach(() => {
  credentials = new InMemoryCredentialRepository()
  limiter = new AllowingRateLimiter()
  register = registerWith(credentials)
})

const attempt = (email: string, password: string): Promise<unknown> =>
  register.execute({ email, password, callerKey: 'ip-1' })

describe('a new address', () => {
  it('is accepted and stored once', async () => {
    const result = await register.execute({ email: EMAIL, password: PASSWORD, callerKey: 'ip-1' })

    expect(result).toStrictEqual({ accepted: true })
    expect(credentials.size).toBe(1)
  })

  it('stores a hash, never the password', async () => {
    await attempt(EMAIL, PASSWORD)

    const stored = await credentials.findByEmail(EmailAddress.of(EMAIL))
    expect(stored?.passwordHash).toBe(`hashed:${PASSWORD}`)
  })

  it('normalises the address, so two spellings cannot become two accounts', async () => {
    await attempt('  NEWCOMER@Kurasikapa.TV ', PASSWORD)

    expect(await credentials.findByEmail(EmailAddress.of(EMAIL))).not.toBeNull()
  })

  it('stamps the account from the clock, not the wall', async () => {
    await attempt(EMAIL, PASSWORD)

    const stored = await credentials.findByEmail(EmailAddress.of(EMAIL))
    expect(stored?.snapshot().createdAt).toEqual(NOW)
  })
})

describe('an address that already has an account', () => {
  beforeEach(async () => {
    await credentials.create(
      Credential.register({
        userId: userId('usr_existing'),
        email: EmailAddress.of(EMAIL),
        passwordHash: 'hashed:the original passphrase',
        now: NOW,
      }),
    )
  })

  it('returns the SAME result as a successful registration', async () => {
    // Any difference here — a different shape, a thrown error, even a
    // different latency profile — is an account-existence oracle a stranger
    // can query one address at a time. On a news site the account list
    // overlaps the source list, so that is a safety question, not a UX one.
    const result = await register.execute({ email: EMAIL, password: PASSWORD, callerKey: 'ip-1' })

    expect(result).toStrictEqual({ accepted: true })
  })

  it('leaves the existing account untouched', async () => {
    await attempt(EMAIL, PASSWORD)

    // The neutral answer must not cost the incumbent their password. If the
    // insert became an upsert, anyone could reset any account by "registering".
    const stored = await credentials.findByEmail(EmailAddress.of(EMAIL))
    expect(stored?.passwordHash).toBe('hashed:the original passphrase')
    expect(stored?.userId).toBe('usr_existing')
    expect(credentials.size).toBe(1)
  })

  it('still refuses a weak password, exactly as it would for a free address', async () => {
    // Validation runs BEFORE the existence check for this reason: if a taken
    // address answered "accepted" while a free one answered "too short", the
    // password rule would leak the very fact the neutral result hides.
    await expect(attempt(EMAIL, 'short')).rejects.toBeInstanceOf(PasswordTooShort)
  })
})

describe('the password rules', () => {
  it.each([
    ['shorter than the minimum', 'elevenchars', PasswordTooShort],
    ['longer than the hashing cap', 'x'.repeat(257), PasswordTooLong],
    ['containing the account name', 'newcomer is my password', PasswordContainsIdentity],
  ])('refuses one %s', async (_why, password, expected) => {
    await expect(attempt(EMAIL, password)).rejects.toBeInstanceOf(expected)
  })

  it('creates nothing when the password is refused', async () => {
    await expect(attempt(EMAIL, 'short')).rejects.toThrow()

    expect(credentials.size).toBe(0)
  })

  it('refuses a string that cannot be an address', async () => {
    await expect(attempt('not-an-address', PASSWORD)).rejects.toBeInstanceOf(InvalidEmailAddress)
  })
})

describe('throttling', () => {
  it('counts the attempt under a key of its own', async () => {
    await attempt(EMAIL, PASSWORD)

    // A separate bucket from sign-in: sharing one would let a scripted
    // registration run exhaust a reader's ability to sign in.
    expect(limiter.consumed).toStrictEqual(['register:ip-1'])
  })

  it('refuses once the limiter says so, and creates nothing', async () => {
    limiter.deny()

    await expect(attempt(EMAIL, PASSWORD)).rejects.toBeInstanceOf(RegistrationThrottled)
    expect(credentials.size).toBe(0)
  })

  it('is checked before the password is hashed', async () => {
    // Hashing is deliberately slow. Doing it for a caller we have already
    // throttled turns the rate limiter into an amplifier pointed at our CPU.
    limiter.deny()

    await expect(attempt(EMAIL, 'short')).rejects.toBeInstanceOf(RegistrationThrottled)
  })

  it('tells the caller how long to wait', async () => {
    limiter.deny()

    await expect(attempt(EMAIL, PASSWORD)).rejects.toMatchObject({ retryAfterSeconds: 42 })
  })
})

describe('a store failure is not a registration', () => {
  it('surfaces anything that is not a duplicate address', async () => {
    // Only `EmailAlreadyRegistered` may be swallowed. Swallow more than that
    // and a store that is down answers "accepted" while nothing was written
    // and no confirmation email will ever arrive.
    const failing = registerWith(new ExplodingCredentialRepository())

    await expect(
      failing.execute({ email: EMAIL, password: PASSWORD, callerKey: 'ip-1' }),
    ).rejects.toThrow(CREDENTIAL_STORE_UNAVAILABLE)
  })
})
