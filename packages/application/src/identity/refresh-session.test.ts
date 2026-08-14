import { beforeEach, describe, expect, it } from 'vitest'
import { userId } from '@kurasikapa/domain'
import {
  FakeClock,
  FakeSecretGenerator,
  FakeTokenSigner,
  InMemoryRefreshTokenRepository,
  SequentialIds,
} from '../testing'
import { SessionIssuer, type SessionTokens } from './issue-session'
import { RefreshSession, SessionNotRefreshable } from './refresh-session'
import { SignOut } from './sign-out'

const NOW = new Date('2026-08-14T10:00:00.000Z')
const USER = userId('u1')

let refreshTokens: InMemoryRefreshTokenRepository
let clock: FakeClock
let sessions: SessionIssuer
let refresh: RefreshSession
let signOut: SignOut
let first: SessionTokens

beforeEach(async () => {
  refreshTokens = new InMemoryRefreshTokenRepository()
  clock = new FakeClock(NOW)
  const secrets = new FakeSecretGenerator()

  sessions = new SessionIssuer({
    tokens: new FakeTokenSigner(),
    refreshTokens,
    secrets,
    clock,
    ids: new SequentialIds(),
  })

  refresh = new RefreshSession({ refreshTokens, secrets, sessions, clock })
  signOut = new SignOut({ refreshTokens, secrets })

  first = await sessions.issue(USER)
})

describe('refreshing', () => {
  it('returns a new pair', async () => {
    const next = await refresh.execute({ refreshToken: first.refreshToken })

    expect(next.refreshToken).not.toBe(first.refreshToken)
    expect(next.accessToken).toBeTruthy()
  })

  it('keeps the caller in the same session family', async () => {
    // The family is what "a session" means. A new family per refresh would
    // make signing out of one browser leave the others running.
    const next = await refresh.execute({ refreshToken: first.refreshToken })

    expect(next.sessionId).toBe(first.sessionId)
  })

  it('refuses a token it has never seen', async () => {
    await expect(refresh.execute({ refreshToken: 'invented' })).rejects.toBeInstanceOf(
      SessionNotRefreshable,
    )
  })

  it('refuses an expired token', async () => {
    clock.advance(31 * 24 * 60 * 60 * 1000)

    await expect(refresh.execute({ refreshToken: first.refreshToken })).rejects.toBeInstanceOf(
      SessionNotRefreshable,
    )
  })

  it('refuses a token from a signed-out session', async () => {
    await signOut.execute({ refreshToken: first.refreshToken })

    await expect(refresh.execute({ refreshToken: first.refreshToken })).rejects.toBeInstanceOf(
      SessionNotRefreshable,
    )
  })
})

describe('reuse is treated as theft', () => {
  it('refuses a token that was already spent', async () => {
    const rotated = refreshTokens.all()[0]
    refreshTokens.setState(rotated!.id, 'rotated')

    await expect(refresh.execute({ refreshToken: first.refreshToken })).rejects.toBeInstanceOf(
      SessionNotRefreshable,
    )
  })

  it('revokes the WHOLE family, not just the replayed token', async () => {
    // There is no way to tell which holder is the reader, so both are signed
    // out. One unexpected sign-in beats an attacker refreshing for a month.
    const second = await refresh.execute({ refreshToken: first.refreshToken })

    await expect(refresh.execute({ refreshToken: first.refreshToken })).rejects.toThrow()

    // The legitimate holder's newer token is dead too.
    await expect(refresh.execute({ refreshToken: second.refreshToken })).rejects.toBeInstanceOf(
      SessionNotRefreshable,
    )
    expect(refreshTokens.all().every((row) => row.state === 'revoked')).toBe(true)
  })

  it('says the same thing as any other refusal', async () => {
    // Distinguishable messages would tell whoever holds a stolen token whether
    // they had been detected.
    await refresh.execute({ refreshToken: first.refreshToken })

    const reused = await refresh
      .execute({ refreshToken: first.refreshToken })
      .catch((e: unknown) => (e as Error).message)
    const unknown = await refresh
      .execute({ refreshToken: 'invented' })
      .catch((e: unknown) => (e as Error).message)

    expect(reused).toBe(unknown)
  })
})

describe('signing out', () => {
  it('ends the family, so no rotation survives', async () => {
    const second = await refresh.execute({ refreshToken: first.refreshToken })

    await signOut.execute({ refreshToken: second.refreshToken })

    expect(refreshTokens.all().every((row) => row.state === 'revoked')).toBe(true)
  })

  it('is silent when the token is already gone', async () => {
    // Clicking sign out twice is not an error; the caller's intent is
    // satisfied either way.
    await expect(signOut.execute({ refreshToken: 'already-gone' })).resolves.toBeUndefined()
    await expect(signOut.execute({ refreshToken: null })).resolves.toBeUndefined()
  })

  it('can end every session a user has', async () => {
    const otherBrowser = await sessions.issue(USER)

    await signOut.execute({ refreshToken: null, allSessions: true, userId: USER })

    await expect(refresh.execute({ refreshToken: otherBrowser.refreshToken })).rejects.toThrow()
    await expect(refresh.execute({ refreshToken: first.refreshToken })).rejects.toThrow()
  })
})
