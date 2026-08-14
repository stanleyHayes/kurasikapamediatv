import type { UserId } from '@kurasikapa/domain'
import type { RefreshTokenRepository } from '../ports/refresh-token-repository'
import type { SecretGenerator } from '../ports/totp'
import type { UseCase } from '../ports/use-case'

export interface SignOutInput {
  /** The refresh token being surrendered. Absent if the cookie was lost. */
  readonly refreshToken: string | null
  /** Sign out everywhere, not just this browser. */
  readonly allSessions?: boolean
  readonly userId?: UserId
}

/**
 * Ends a session.
 *
 * Idempotent and silent: signing out with a token that is already gone is a
 * success, because the caller's intent — "I should not be signed in" — is
 * satisfied. Reporting an error would only ever confuse someone who clicked
 * twice.
 *
 * Revokes the whole FAMILY rather than the single token presented. A session
 * is the family; leaving its other rotations alive would mean signing out did
 * not sign you out.
 */
export class SignOut implements UseCase<SignOutInput, void> {
  constructor(
    private readonly deps: {
      readonly refreshTokens: RefreshTokenRepository
      readonly secrets: SecretGenerator
    },
  ) {}

  async execute(input: SignOutInput): Promise<void> {
    if (input.allSessions === true && input.userId !== undefined) {
      await this.deps.refreshTokens.revokeAllForUser(input.userId)

      return
    }

    if (input.refreshToken === null) return

    const record = await this.deps.refreshTokens.findByHash(
      this.deps.secrets.sha256(input.refreshToken),
    )
    if (record === null) return

    await this.deps.refreshTokens.revokeFamily(record.sessionId)
  }
}
