import { RECOVERY_CODE_COUNT, TotpAlreadyEnrolled, type UserId } from '@kurasikapa/domain'
import type { ClockPort } from '../ports/ambient'
import type { CredentialRepository } from '../ports/credential-repository'
import type { PasswordHasher } from '../ports/password-hasher'
import type { SecretGenerator, TotpPort } from '../ports/totp'
import type { UseCase } from '../ports/use-case'

export interface EnrolSecondFactorInput {
  readonly userId: UserId
  /** Re-authentication. Enrolling is a change to how the account is defended. */
  readonly password: string
}

export interface EnrolSecondFactorResult {
  /** The `otpauth://` URI the authenticator app scans. */
  readonly provisioningUri: string
  /**
   * Shown ONCE, in plaintext, and never again — only their hashes are stored.
   *
   * These are the whole safety net for the enrolment being single-step: the
   * factor is live the moment this returns, so someone who closes the page
   * before scanning the QR needs another way in, and this is it.
   */
  readonly recoveryCodes: readonly string[]
}

export class EnrolmentRefused extends Error {
  constructor() {
    // One message for an unknown user and a wrong password. This endpoint is
    // reached by someone already signed in, but the password is a second
    // credential and confirming it separately is still an oracle.
    super('That password did not match.')
    this.name = 'EnrolmentRefused'
  }
}

export interface EnrolSecondFactorDeps {
  readonly credentials: CredentialRepository
  readonly passwords: PasswordHasher
  readonly totp: TotpPort
  readonly secrets: SecretGenerator
  readonly clock: ClockPort
  /** Appears in the authenticator app beside the account. */
  readonly issuer: string
}

/** 20 bytes — the same width as the shared secret; guessing is not the threat. */
const RECOVERY_CODE_BYTES = 20

/**
 * Turns on a second factor for an account that already has a password.
 *
 * Single-step on purpose. A two-step "generate, then confirm before storing"
 * flow has to carry the unconfirmed secret somewhere — a new signed token kind,
 * or a half-enrolled row — and both add a state that can be abandoned. Storing
 * it immediately and handing back recovery codes in the same response makes
 * the only failure mode ("I closed the tab") recoverable with something the
 * user is already holding.
 *
 * Re-authenticates first. A signed-in session is not enough: an unattended
 * browser could otherwise be used to enrol an attacker's authenticator, which
 * locks the real owner out of their own account.
 */
export class EnrolSecondFactor
  implements UseCase<EnrolSecondFactorInput, EnrolSecondFactorResult>
{
  constructor(private readonly deps: EnrolSecondFactorDeps) {}

  async execute(input: EnrolSecondFactorInput): Promise<EnrolSecondFactorResult> {
    const credential = await this.deps.credentials.findByUserId(input.userId)
    if (credential === null) throw new EnrolmentRefused()

    const stored = credential.passwordHash
    if (stored === null) throw new EnrolmentRefused()
    if (!(await this.deps.passwords.verify(input.password, stored))) {
      throw new EnrolmentRefused()
    }

    // Thrown by the domain rather than checked here, so the invariant has one
    // home. Re-enrolling would replace a working authenticator with a new one
    // and silently invalidate the recovery codes already printed.
    if (credential.requiresSecondFactor) throw new TotpAlreadyEnrolled()

    const secret = this.deps.totp.generateSecret()
    const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      this.deps.secrets.token(RECOVERY_CODE_BYTES),
    )

    await this.deps.credentials.update(
      credential.enrolTotp(
        secret,
        recoveryCodes.map((code) => this.deps.secrets.sha256(code)),
        this.deps.clock.now(),
      ),
    )

    return {
      provisioningUri: this.deps.totp.provisioningUri({
        secret,
        account: credential.email.value,
        issuer: this.deps.issuer,
      }),
      recoveryCodes,
    }
  }
}
