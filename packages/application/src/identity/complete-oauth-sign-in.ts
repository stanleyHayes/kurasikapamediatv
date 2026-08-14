import { OAuthStateMismatch, type OAuthProvider } from '../ports/oauth-provider'
import type { SecretGenerator } from '../ports/totp'
import type { UseCase } from '../ports/use-case'
import type { SessionTokens } from './issue-session'
import type { SignInWithProvider } from './sign-in-with-provider'

export interface CompleteOAuthInput {
  readonly provider: OAuthProvider
  readonly redirectUri: string
  /** The authorization code the provider sent back. */
  readonly code: string
  /** The `state` the PROVIDER echoed — attacker-controlled until checked. */
  readonly presentedState: string
  /** The `state` WE issued, read from a cookie we set. */
  readonly expectedState: string
  readonly nonce: string | null
  readonly codeVerifier: string | null
}

/**
 * The OAuth callback, start to finish, in one use case.
 *
 * This exists because the CSRF check has to be impossible to forget. An
 * earlier shape had `OAuthProvider.exchange()` take the code but not the
 * state, which made verifying it structurally impossible for any adapter and
 * left it to "the caller" — and there was no caller doing it. The `state` was
 * generated, returned, and dropped: login CSRF was unimplemented rather than
 * merely elsewhere.
 *
 * Putting the sequence here means a route handler cannot perform the exchange
 * without also performing the check, because there is only one door.
 *
 * What login CSRF costs, concretely: an attacker completes an authorization
 * with THEIR provider account, captures the callback URL, and lures a signed-in
 * reader into visiting it. The reader's browser silently links the attacker's
 * Google identity to the reader's session — and from then on the attacker can
 * sign in as them.
 */
export class CompleteOAuthSignIn implements UseCase<CompleteOAuthInput, SessionTokens> {
  constructor(
    private readonly deps: {
      readonly signInWithProvider: SignInWithProvider
      readonly secrets: SecretGenerator
    },
  ) {}

  async execute(input: CompleteOAuthInput): Promise<SessionTokens> {
    this.assertStateMatches(input.presentedState, input.expectedState)

    const external = await input.provider.exchange({
      code: input.code,
      redirectUri: input.redirectUri,
      nonce: input.nonce,
      codeVerifier: input.codeVerifier,
    })

    return this.deps.signInWithProvider.execute({ external })
  }

  /**
   * Compared in constant time, and rejected when EITHER side is blank.
   *
   * The blank check is the one that matters. `expectedState` comes from a
   * cookie, and the idiomatic read — `cookies().get('state')?.value ?? ''` —
   * yields `''` when the cookie is missing or expired. Without this guard an
   * attacker who simply omits the cookie makes both sides `''`, the comparison
   * succeeds, and the defence disappears exactly when it is needed.
   */
  private assertStateMatches(presented: string, expected: string): void {
    if (presented === '' || expected === '') throw new OAuthStateMismatch()
    if (!this.deps.secrets.equals(presented, expected)) throw new OAuthStateMismatch()
  }
}
