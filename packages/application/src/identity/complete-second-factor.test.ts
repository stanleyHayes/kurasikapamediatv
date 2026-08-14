import { beforeEach, describe, expect, it } from 'vitest'
import {
  Credential,
  EmailAddress,
  InvalidTotpCode,
  TokenExpired,
  TotpCodeAlreadyUsed,
  WrongTokenKind,
  claimsFor,
  counterAt,
  userId,
  type TokenKind,
  type UserId,
} from '@kurasikapa/domain'
import {
  AllowingRateLimiter,
  FakeClock,
  FakeSecretGenerator,
  FakeTokenSigner,
  FakeTotp,
  InMemoryCredentialRepository,
  InMemoryRefreshTokenRepository,
  SequentialIds,
} from '../testing'
import { InvalidToken } from '../ports/token-signer'
import { CompleteSecondFactor, SecondFactorThrottled } from './complete-second-factor'
import { SessionIssuer } from './issue-session'

const NOW = new Date('2026-08-14T10:00:00.000Z')
const USER = userId('u1')
const SECRET = 'FAKESECRET'
const RECOVERY = 'rescuecodealpha'

const totp = new FakeTotp()
const secrets = new FakeSecretGenerator()

let credentials: InMemoryCredentialRepository
let refreshTokens: InMemoryRefreshTokenRepository
let limiter: AllowingRateLimiter
let tokens: FakeTokenSigner
let clock: FakeClock
let complete: CompleteSecondFactor

/** The code an authenticator would be showing `steps` away from `NOW`. */
const codeAt = (steps = 0): string => totp.codeAt(SECRET, counterAt(NOW) + steps)

const challengeFor = (sub: UserId, kind: TokenKind = 'challenge'): Promise<string> =>
  tokens.sign(claimsFor({ userId: sub, sessionId: `pending:${sub}`, kind, now: NOW }))

const present = async (code: string, token?: string): Promise<unknown> =>
  complete.execute({
    challengeToken: token ?? (await challengeFor(USER)),
    code,
    callerKey: 'ip-1',
  })

beforeEach(async () => {
  credentials = new InMemoryCredentialRepository()
  refreshTokens = new InMemoryRefreshTokenRepository()
  limiter = new AllowingRateLimiter()
  tokens = new FakeTokenSigner()
  clock = new FakeClock(NOW)

  complete = new CompleteSecondFactor({
    credentials,
    tokens,
    totp,
    secrets,
    sessions: new SessionIssuer({
      tokens,
      refreshTokens,
      secrets,
      clock,
      ids: new SequentialIds(),
    }),
    limiter,
    clock,
  })

  const enrolled = Credential.register({
    userId: USER,
    email: EmailAddress.of('editor@kurasikapa.tv'),
    passwordHash: 'hashed:whatever',
    now: NOW,
  }).enrolTotp(SECRET, [secrets.sha256(RECOVERY)], NOW)

  await credentials.create(enrolled)
})

describe('a correct authenticator code', () => {
  it('issues a session', async () => {
    await expect(present(codeAt())).resolves.toMatchObject({ sessionId: 'id_1' })

    expect(refreshTokens.all()[0]?.state).toBe('active')
  })

  it('is accepted one step either side of now', async () => {
    // ±1 step — a 90-second window. Narrower rejects a phone whose clock is
    // fifteen seconds out, which is common enough that people conclude 2FA is
    // broken and switch it off.
    await expect(present(codeAt(-1))).resolves.toBeDefined()
  })

  it('is accepted with the spaces people actually type', async () => {
    const spaced = `${codeAt().slice(0, 3)} ${codeAt().slice(3)}`

    await expect(present(spaced)).resolves.toBeDefined()
  })

  it('records the step it was accepted at', async () => {
    await present(codeAt())

    expect((await credentials.findByUserId(USER))?.totp?.lastUsedCounter).toBe(counterAt(NOW))
  })
})

describe('replay inside the drift window', () => {
  it('refuses the same code a second time', async () => {
    // Without this the drift window IS a replay window: a code shoulder-surfed
    // or captured by a phishing page stays good for up to 90 seconds, and the
    // second factor becomes a second password with a short life.
    await present(codeAt())

    await expect(present(codeAt())).rejects.toBeInstanceOf(TotpCodeAlreadyUsed)
  })

  it('refuses an EARLIER step once a later one has been used', async () => {
    await present(codeAt())

    // Still inside the acceptance window, and still a code that has been seen.
    await expect(present(codeAt(-1))).rejects.toBeInstanceOf(TotpCodeAlreadyUsed)
  })

  it('issues no session for the replay', async () => {
    await present(codeAt())
    await expect(present(codeAt())).rejects.toThrow()

    expect(refreshTokens.all()).toHaveLength(1)
  })

  it('lets the NEXT step through', async () => {
    await present(codeAt())

    await expect(present(codeAt(1))).resolves.toBeDefined()
  })
})

describe('recovery codes', () => {
  it('accepts one, and signs the caller in', async () => {
    await expect(present(RECOVERY)).resolves.toBeDefined()
  })

  it('burns it, so the printed list shrinks', async () => {
    await present(RECOVERY)

    expect((await credentials.findByUserId(USER))?.totp?.recoveryCodeHashes).toStrictEqual([])
  })

  it('refuses the same one twice', async () => {
    await present(RECOVERY)

    await expect(present(RECOVERY)).rejects.toBeInstanceOf(InvalidTotpCode)
  })

  it('refuses one that was never issued', async () => {
    await expect(present('rescuecodeomega')).rejects.toBeInstanceOf(InvalidTotpCode)
  })
})

describe('a wrong code', () => {
  it('is refused, and issues nothing', async () => {
    await expect(present(codeAt(5))).rejects.toBeInstanceOf(InvalidTotpCode)
    expect(refreshTokens.all()).toHaveLength(0)
  })

  it('does not move the replay marker', async () => {
    // Recording a failed attempt's counter would let anyone lock the account
    // out of its own current code by guessing a future one.
    await expect(present(codeAt(5))).rejects.toThrow()

    expect((await credentials.findByUserId(USER))?.totp?.lastUsedCounter).toBeNull()
  })

  it('expires with the window', async () => {
    clock.advance(2 * 30 * 1000)

    await expect(present(codeAt())).rejects.toBeInstanceOf(InvalidTotpCode)
  })
})

describe('the challenge is the control', () => {
  it.each([['access'], ['refresh']] as const)('refuses a %s token', async (kind) => {
    // The kind check is what stops this endpoint accepting a code for any
    // account from anyone already signed in — which is how a second factor
    // becomes the ONLY factor.
    await expect(present(codeAt(), await challengeFor(USER, kind))).rejects.toBeInstanceOf(
      WrongTokenKind,
    )
    expect(refreshTokens.all()).toHaveLength(0)
  })

  it('refuses a challenge that has aged out', async () => {
    // Five minutes plus the skew tolerance. A challenge captured from a URL or
    // a log must be useless by the time anybody reads it.
    clock.advance((5 * 60 + 31) * 1000)

    await expect(present(codeAt())).rejects.toBeInstanceOf(TokenExpired)
  })

  it('refuses a token we did not sign', async () => {
    await expect(present(codeAt(), 'forged.{"sub":"u1","kind":"challenge"}')).rejects.toBeInstanceOf(
      InvalidToken,
    )
  })

  it('refuses a challenge naming an account with no second factor', async () => {
    const noTotp = userId('u2')
    await credentials.create(
      Credential.register({
        userId: noTotp,
        email: EmailAddress.of('reader@kurasikapa.tv'),
        passwordHash: 'hashed:whatever',
        now: NOW,
      }),
    )

    await expect(present(codeAt(), await challengeFor(noTotp))).rejects.toBeInstanceOf(
      InvalidTotpCode,
    )
  })

  it('refuses a challenge naming nobody at all', async () => {
    await expect(present(codeAt(), await challengeFor(userId('ghost')))).rejects.toBeInstanceOf(
      InvalidTotpCode,
    )
  })
})

describe('throttling', () => {
  it('counts the attempt under a key of its own', async () => {
    await present(codeAt())

    expect(limiter.consumed).toStrictEqual(['2fa:ip-1'])
  })

  it('refuses once the limiter says so, before the challenge is even read', async () => {
    // Six digits is one in a million per guess, but the drift window keeps
    // three of them live at once. Unthrottled, that is a feasible online
    // attack rather than a theoretical one.
    limiter.deny()

    await expect(present(codeAt(), 'forged.nonsense')).rejects.toBeInstanceOf(
      SecondFactorThrottled,
    )
  })

  it('tells the caller how long to wait', async () => {
    limiter.deny()

    await expect(present(codeAt())).rejects.toMatchObject({ retryAfterSeconds: 42 })
  })
})
