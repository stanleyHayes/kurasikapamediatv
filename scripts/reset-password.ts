/**
 * One-off administrative password reset.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  THIS SCRIPT DELIBERATELY BYPASSES THE PLATFORM PASSWORD POLICY.
 *
 *  `ChangePassword` (packages/application/src/identity/change-password.ts)
 *  calls `assertAcceptablePassword`, which enforces the 12-character floor in
 *  packages/domain/src/identity/password-policy.ts. This script does not. It
 *  exists because an account had to be given a password shorter than the
 *  domain will accept, and the alternative — lowering MIN_LENGTH — would have
 *  weakened every account on the platform to do it.
 *
 *  The consequence is real and worth stating: the credential this writes is
 *  one the application itself would refuse to set. The owner cannot reproduce
 *  it through Studio's own "change password" form, and the next rotation
 *  through that form will be held to the full 12-character rule.
 *
 *  Do not turn this into an endpoint, a Server Action, or a use case. It is
 *  run by hand, by someone with the production connection string, and every
 *  run is one account.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * What it does NOT skip: the hash format and the session revocation. The
 * password is hashed with the application's own `ScryptPasswordHasher`, so
 * sign-in verifies it exactly as it would any other credential, and every
 * refresh token for the account is revoked — the same thing `ChangePassword`
 * does, so a stolen session cannot outlive the reset.
 *
 * Usage — read the password rather than typing it into the command line, so it
 * never enters shell history:
 *
 *   read -rs NEW_PASSWORD && export NEW_PASSWORD
 *   MONGODB_URI="mongodb+srv://…" MONGODB_DB="kurasikapa" \
 *     node scripts/reset-password.ts --email info@kurasikapamediatv.com
 *   unset NEW_PASSWORD
 *
 * The password is taken from the environment and never from argv, because argv
 * is world-readable through `ps` for as long as the process runs. The
 * environment is not a perfect hiding place either — which is what `read -rs`
 * and the trailing `unset` are for. Writing it inline as
 * `NEW_PASSWORD='…' node …` works, but puts the password in history; do that
 * only on a machine where that does not matter.
 */

// Relative, not '@kurasikapa/adapter-auth': Node runs this file with type
// stripping, which it does not apply inside node_modules — and a workspace
// package is a symlink into node_modules. Reimplementing the hash here instead
// would be the actual mistake; a credential the app cannot verify is worse
// than an awkward import path.
import { ScryptPasswordHasher } from '../packages/adapter-auth/src/scrypt-password-hasher.ts'
import { MongoClient } from 'mongodb'

const CREDENTIALS = 'credentials'
const REFRESH_TOKENS = 'refresh_tokens'
const LEGACY_ACCOUNTS = 'account'

function required(name: string): string {
  const value = process.env[name]
  if (value === undefined || value === '') {
    throw new Error(`${name} is required. Refusing to guess.`)
  }

  return value
}

function emailArgument(): string {
  const index = process.argv.indexOf('--email')
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (value?.includes('@') !== true) {
    throw new Error('Pass the account as --email someone@example.com')
  }

  // The domain normalises before writing, so matching has to normalise too.
  // Searching for the address as typed silently finds nothing for anyone who
  // capitalised it, and "no such account" is the least useful possible answer.
  return value.trim().toLowerCase()
}

async function main(): Promise<void> {
  const email = emailArgument()
  const password = required('NEW_PASSWORD')
  const client = new MongoClient(required('MONGODB_URI'), { serverSelectionTimeoutMS: 10_000 })

  try {
    const db = client.db(required('MONGODB_DB'))
    const credentials = db.collection(CREDENTIALS)
    const existing = await credentials.findOne({ email })

    // A Better Auth row that never signed in since KUR-66 has no native
    // credential yet. Writing a fresh one would create a SECOND way into the
    // account rather than changing the existing one, so this stops instead.
    if (existing === null) {
      const legacy = await db.collection(LEGACY_ACCOUNTS).countDocuments({}, { limit: 1 })
      throw new Error(
        `No credential for ${email} in "${CREDENTIALS}".`
        + (legacy > 0
          ? ' A legacy Better Auth row may exist; that account must sign in once with its old'
            + ' password to be migrated before it can be reset here.'
          : ''),
      )
    }

    // The credential's _id IS the user id — one credential per user, which is
    // why the same value keys the refresh tokens below.
    const { _id: userId } = existing
    const passwordHash = await new ScryptPasswordHasher().hash(password)
    const now = new Date()

    await credentials.updateOne({ _id: userId }, { $set: { passwordHash, updatedAt: now } })

    // Same as ChangePassword: the password is only half of it. Leaving live
    // refresh tokens in place means whoever prompted the reset keeps their
    // session.
    const revoked = await db.collection(REFRESH_TOKENS).updateMany(
      { userId: String(userId), state: 'active' },
      { $set: { state: 'revoked' } },
    )

    console.log(`Password reset for ${email}.`)
    console.log(`Revoked ${String(revoked.modifiedCount)} active session(s).`)
    console.log('This password is shorter than the platform policy allows; the next change')
    console.log('through Studio will be held to the full 12-character minimum.')
  } finally {
    await client.close()
  }
}

await main()
