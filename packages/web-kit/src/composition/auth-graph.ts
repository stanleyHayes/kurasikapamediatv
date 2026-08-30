import {
  CompleteOAuthSignIn,
  CompleteSecondFactor,
  ChangePassword,
  EnrolSecondFactor,
  RefreshSession,
  RegisterUser,
  SessionIssuer,
  SignInWithPassword,
  SignInWithProvider,
  SignOut,
  UpdateOwnProfile,
  type OAuthProvider,
} from '@kurasikapa/application'
import {
  JoseTokenSigner,
  NodeSecretGenerator,
  Rfc6238Totp,
  ScryptPasswordHasher,
} from '@kurasikapa/adapter-auth'
import {
  MongoCredentialRepository,
  MongoRateLimiter,
  MongoRefreshTokenRepository,
  MongoUserDirectory,
} from '@kurasikapa/adapter-mongo'
import type { ExternalProvider } from '@kurasikapa/domain'
import { cryptoIds, systemClock } from './ambient'
import { env } from './env'
import { mongoDb } from './mongo'
import { siteUrl } from './origins'
import { appleProvider, facebookProvider, googleProvider } from './oauth-providers'

/**
 * The authentication graph.
 *
 * Separate from `container()` because that one is the editorial graph and is
 * already large; more importantly, this one is reached from route handlers on
 * the anonymous path — sign-in, refresh, callbacks — where dragging in every
 * editorial repository would be waste on the hottest, least authenticated
 * surface we have.
 */
export interface AuthGraph {
  readonly tokens: JoseTokenSigner
  readonly totp: Rfc6238Totp
  readonly secrets: NodeSecretGenerator
  readonly register: RegisterUser
  readonly signIn: SignInWithPassword
  readonly secondFactor: CompleteSecondFactor
  readonly refresh: RefreshSession
  readonly signOut: SignOut
  readonly signInWithProvider: SignInWithProvider
  /**
   * The OAuth callback, start to finish — the ONLY door.
   *
   * Exposed rather than left to route code assembling `signInWithProvider`
   * itself, because this use case is where the `state` comparison lives. A
   * callback that reaches the token exchange without it is login CSRF, and the
   * whole point of the use case is that skipping the check is not expressible.
   */
  readonly completeOAuthSignIn: CompleteOAuthSignIn
  /**
   * Turning a second factor ON. Kept beside the one that CHECKS it, because
   * the two must agree about where the secret lives — an enrolment written to
   * a store the verifier does not read is a factor nobody is ever asked for.
   */
  readonly enrolSecondFactor: EnrolSecondFactor
  readonly changePassword: ChangePassword
  readonly updateOwnProfile: UpdateOwnProfile
  readonly users: MongoUserDirectory
  /**
   * Exposed for the enrolment-confirmation route, which reads the enrolled
   * secret to check one code without issuing a session or consuming a counter.
   */
  readonly credentials: MongoCredentialRepository
  /** Only the providers whose credentials are configured. */
  readonly providers: ReadonlyMap<ExternalProvider, OAuthProvider>
}

let instance: AuthGraph | undefined

/**
 * The secret that signs sessions.
 *
 * Reads the new name first and falls back to the old one, so this can be
 * renamed on a deployment where both are set rather than in a flag day that
 * signs every reader out. Rotating it invalidates every access token; refresh
 * tokens survive, because those are looked up rather than verified.
 */
function sessionSecret(): string {
  return env().AUTH_SECRET ?? env().BETTER_AUTH_SECRET
}

export function authGraph(): AuthGraph {
  instance ??= build()

  return instance
}

function build(): AuthGraph {
  const db = mongoDb()
  const credentials = new MongoCredentialRepository(db)
  const refreshTokens = new MongoRefreshTokenRepository(db)
  const users = new MongoUserDirectory(db)
  const limiter = new MongoRateLimiter(db, systemClock)
  const secrets = new NodeSecretGenerator()
  const passwords = new ScryptPasswordHasher()
  const totp = new Rfc6238Totp()

  const tokens = new JoseTokenSigner({
    secret: sessionSecret(),
    // Bound to the SITE, not to this deployment. The studio verifies tokens
    // the site minted, so an `iss`/`aud` derived from APP_URL would make every
    // session the site issued invalid the moment the studio read it.
    issuer: siteUrl(env()),
    audience: 'urn:kurasikapa:session',
  })
  const sessions = new SessionIssuer({
    tokens,
    refreshTokens,
    secrets,
    clock: systemClock,
    ids: cryptoIds,
  })
  return {
    tokens,
    totp,
    secrets,
    providers: configuredProviders(secrets),
    ...useCases({ credentials, refreshTokens, users, limiter, secrets, passwords, totp, tokens, sessions }),
  }
}

/** Split out purely to keep `build` under the 50-line function cap. */
function useCases(d: UseCaseDeps): Omit<AuthGraph, 'tokens' | 'totp' | 'secrets' | 'providers'> {
  const { credentials, refreshTokens, users, limiter, passwords, totp, tokens, sessions, secrets } = d
  const signInWithProvider = new SignInWithProvider({ credentials, sessions, clock: systemClock, ids: cryptoIds })

  return {
    credentials,
    register: new RegisterUser({
      credentials,
      passwords,
      limiter,
      clock: systemClock,
      ids: cryptoIds,
    }),
    signIn: new SignInWithPassword({
      credentials,
      passwords,
      tokens,
      sessions,
      limiter,
      clock: systemClock,
    }),
    secondFactor: new CompleteSecondFactor({
      credentials,
      tokens,
      totp,
      secrets,
      sessions,
      limiter,
      clock: systemClock,
    }),
    refresh: new RefreshSession({ refreshTokens, secrets, sessions, clock: systemClock }),
    signOut: new SignOut({ refreshTokens, secrets }),
    signInWithProvider,
    completeOAuthSignIn: new CompleteOAuthSignIn({ signInWithProvider, secrets }),
    enrolSecondFactor: new EnrolSecondFactor({
      credentials,
      passwords,
      totp,
      secrets,
      clock: systemClock,
      issuer: 'Kurasikapa Media',
    }),
    changePassword: new ChangePassword({ credentials, passwords, refreshTokens, clock: systemClock }),
    updateOwnProfile: new UpdateOwnProfile(users),
    users,
  }
}

interface UseCaseDeps {
  readonly credentials: MongoCredentialRepository
  readonly refreshTokens: MongoRefreshTokenRepository
  readonly users: MongoUserDirectory
  readonly limiter: MongoRateLimiter
  readonly passwords: ScryptPasswordHasher
  readonly totp: Rfc6238Totp
  readonly tokens: JoseTokenSigner
  readonly sessions: SessionIssuer
  readonly secrets: NodeSecretGenerator
}

/**
 * A provider appears only when every value it needs is present.
 *
 * Half-configured is worse than absent: the button renders, the reader clicks
 * it, and the provider rejects the redirect with an error page we do not own.
 */
function configuredProviders(
  secrets: NodeSecretGenerator,
): ReadonlyMap<ExternalProvider, OAuthProvider> {
  const providers = new Map<ExternalProvider, OAuthProvider>()

  for (const provider of [
    googleProvider(secrets),
    facebookProvider(secrets),
    appleProvider(secrets, systemClock),
  ]) {
    if (provider !== null) providers.set(provider.provider, provider)
  }

  return providers
}

/** Test seam. */
export function resetAuthGraph(): void {
  instance = undefined
}
