import type { ExternalProvider } from '@kurasikapa/domain'
import {
  OAuthExchangeFailed,
  type AuthorizationRequest,
  type ExternalUser,
  type OAuthProvider,
} from '../ports/oauth-provider'

/** What the callback handed the provider. Recorded so a test can assert it. */
export interface ExchangeCall {
  readonly code: string
  readonly redirectUri: string
  readonly nonce: string | null
  readonly codeVerifier: string | null
}

/**
 * A provider that always says yes, and remembers every time it was asked.
 *
 * `exchanges` is the important part. The CSRF check in CompleteOAuthSignIn is
 * only worth anything if it runs BEFORE the code is redeemed — a check that
 * fires after the exchange has already happened has let the attacker's
 * authorization complete. An empty `exchanges` array is how a test proves the
 * order, and no assertion on the thrown error can prove it instead.
 */
export class FakeOAuthProvider implements OAuthProvider {
  readonly exchanges: ExchangeCall[] = []

  constructor(private readonly identity: ExternalUser) {}

  get provider(): ExternalProvider {
    return this.identity.provider
  }

  authorization(input: { readonly redirectUri: string }): Promise<AuthorizationRequest> {
    return Promise.resolve({
      url: `https://provider.test/authorize?redirect_uri=${input.redirectUri}`,
      state: 'state-1',
      nonce: 'nonce-1',
      codeVerifier: 'verifier-1',
    })
  }

  exchange(input: ExchangeCall): Promise<ExternalUser> {
    this.exchanges.push(input)

    return Promise.resolve(this.identity)
  }
}

/**
 * The provider refuses the code — expired, already redeemed, wrong client.
 *
 * Real and routine: an authorization code is single use and short lived, so a
 * reader who double-submits the callback or comes back to a stale tab lands
 * here. It must surface as `OAuthExchangeFailed` and not as a session.
 */
export class RefusingOAuthProvider implements OAuthProvider {
  readonly exchanges: ExchangeCall[] = []

  constructor(readonly provider: ExternalProvider = 'google') {}

  authorization(): Promise<AuthorizationRequest> {
    return Promise.resolve({ url: 'https://provider.test/authorize', state: 'state-1', nonce: null, codeVerifier: null })
  }

  exchange(input: ExchangeCall): Promise<ExternalUser> {
    this.exchanges.push(input)

    return Promise.reject(new OAuthExchangeFailed(this.provider, 'that code was already redeemed'))
  }
}
