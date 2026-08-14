import { beforeEach, describe, expect, it } from 'vitest'
import {
  FakeClock,
  FakeOAuthProvider,
  FakeSecretGenerator,
  FakeTokenSigner,
  InMemoryCredentialRepository,
  InMemoryRefreshTokenRepository,
  RefusingOAuthProvider,
  SequentialIds,
} from '../testing'
import { OAuthExchangeFailed, OAuthStateMismatch, type ExternalUser } from '../ports/oauth-provider'
import { CompleteOAuthSignIn, type CompleteOAuthInput } from './complete-oauth-sign-in'
import { SessionIssuer } from './issue-session'
import { SignInWithProvider } from './sign-in-with-provider'

const NOW = new Date('2026-08-14T10:00:00.000Z')
const STATE = 'the-state-we-issued'

const READER: ExternalUser = {
  provider: 'google',
  subject: 'google-sub-1',
  email: 'reader@kurasikapa.tv',
  emailVerified: true,
  displayName: 'A Reader',
}

let credentials: InMemoryCredentialRepository
let refreshTokens: InMemoryRefreshTokenRepository
let provider: FakeOAuthProvider
let complete: CompleteOAuthSignIn

const callback = (overrides: Partial<CompleteOAuthInput> = {}): CompleteOAuthInput => ({
  provider,
  redirectUri: 'https://kurasikapa.tv/auth/callback/google',
  code: 'authorization-code-1',
  presentedState: STATE,
  expectedState: STATE,
  nonce: 'nonce-1',
  codeVerifier: 'verifier-1',
  ...overrides,
})

beforeEach(() => {
  credentials = new InMemoryCredentialRepository()
  refreshTokens = new InMemoryRefreshTokenRepository()
  provider = new FakeOAuthProvider(READER)

  complete = new CompleteOAuthSignIn({
    signInWithProvider: new SignInWithProvider({
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
    }),
    secrets: new FakeSecretGenerator(),
  })
})

describe('a callback whose state matches', () => {
  it('redeems the code and signs the reader in', async () => {
    const tokens = await complete.execute(callback())

    expect(tokens.accessToken).toContain('signed.')
    expect(refreshTokens.all()).toHaveLength(1)
    expect(credentials.size).toBe(1)
  })

  it('passes the nonce and PKCE verifier to the exchange', async () => {
    // Both bind the exchange to the browser that started it. Dropping either
    // means an intercepted authorization code can be redeemed by whoever has
    // it, which is exactly what PKCE exists to stop.
    await complete.execute(callback())

    expect(provider.exchanges).toStrictEqual([
      {
        code: 'authorization-code-1',
        redirectUri: 'https://kurasikapa.tv/auth/callback/google',
        nonce: 'nonce-1',
        codeVerifier: 'verifier-1',
      },
    ])
  })
})

describe('the CSRF check', () => {
  it.each<[string, Partial<CompleteOAuthInput>]>([
    ['the two states differ', { presentedState: 'a-state-somebody-else-issued' }],
    ['the presented state is blank', { presentedState: '' }],
    ['the expected state is blank', { expectedState: '' }],
    ['BOTH sides are blank', { presentedState: '', expectedState: '' }],
  ])('refuses when %s', async (_why, overrides) => {
    // The blank cases are the ones that matter. `expectedState` comes from a
    // cookie, and the idiomatic read yields '' when the cookie is missing or
    // expired — so without the emptiness guard an attacker who simply omits
    // the cookie makes both sides equal and the defence disappears exactly
    // when it is needed.
    await expect(complete.execute(callback(overrides))).rejects.toBeInstanceOf(OAuthStateMismatch)
  })

  it('runs BEFORE the code is redeemed', async () => {
    // A check that fires after the exchange has already let the attacker's
    // authorization complete. The empty call log is the only assertion that
    // can tell the two orderings apart.
    await expect(complete.execute(callback({ presentedState: '' }))).rejects.toThrow()

    expect(provider.exchanges).toHaveLength(0)
  })

  it('issues no session and creates no account', async () => {
    await expect(complete.execute(callback({ expectedState: 'a-different-state' }))).rejects.toThrow()

    expect(refreshTokens.all()).toHaveLength(0)
    expect(credentials.size).toBe(0)
  })
})

describe('a provider that refuses the code', () => {
  it('surfaces the failure rather than a session', async () => {
    const refusing = new RefusingOAuthProvider('google')

    await expect(complete.execute(callback({ provider: refusing }))).rejects.toBeInstanceOf(
      OAuthExchangeFailed,
    )
    expect(refreshTokens.all()).toHaveLength(0)
  })
})
