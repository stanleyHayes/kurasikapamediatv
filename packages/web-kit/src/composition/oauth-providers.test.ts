import { FakeClock, FakeSecretGenerator } from '@kurasikapa/application/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetEnv } from './env'
import { appleProvider, facebookProvider, googleProvider, pkcs8FromEnv } from './oauth-providers'

/**
 * Reads real environment variables, because that is what the composition root
 * does. The keys this suite touches are snapshotted and restored, and `env()`
 * is memoised, so every change is followed by `resetEnv()` — without it the
 * second test in a file would still see the first one's environment.
 */
const OWNED = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'FACEBOOK_CLIENT_ID',
  'FACEBOOK_CLIENT_SECRET',
  'APPLE_SERVICES_ID',
  'APPLE_TEAM_ID',
  'APPLE_KEY_ID',
  'APPLE_PRIVATE_KEY',
  'MONGODB_URI',
  'BETTER_AUTH_SECRET',
] as const

const snapshot = new Map(OWNED.map((key) => [key, process.env[key]]))

/** The two values `env()` refuses to parse without. Nothing to do with OAuth. */
const BOOTABLE = {
  MONGODB_URI: 'mongodb://localhost:27017/kurasikapa',
  BETTER_AUTH_SECRET: 'k'.repeat(32),
}

/**
 * Removes rather than assigns for an undefined value. `process.env.X = undefined`
 * stores the STRING "undefined", which reads as configured and would make every
 * "absent" case below pass for the wrong reason.
 */
const setEnv = (values: Record<string, string | undefined>): void => {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) Reflect.deleteProperty(process.env, key)
    else process.env[key] = value
  }

  resetEnv()
}

const APPLE = {
  APPLE_SERVICES_ID: 'tv.kurasikapa.web',
  APPLE_TEAM_ID: 'TEAM123456',
  APPLE_KEY_ID: 'KEY1234567',
  APPLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nMIGTAgEA\\n-----END PRIVATE KEY-----',
}

const secrets = new FakeSecretGenerator()
const clock = new FakeClock(new Date('2026-03-01T00:00:00Z'))

beforeEach(() => {
  for (const key of OWNED) Reflect.deleteProperty(process.env, key)
  setEnv(BOOTABLE)
})

afterEach(() => {
  for (const [key, value] of snapshot) setEnv({ [key]: value })
})

describe('googleProvider', () => {
  it('builds a provider when both credentials are present', () => {
    setEnv({ GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret' })

    expect(googleProvider(secrets)?.provider).toBe('google')
  })

  it('is absent when nothing is configured', () => {
    // CI builds without four sets of OAuth secrets, and must still boot.
    expect(googleProvider(secrets)).toBeNull()
  })

  it('is absent when only half is configured', () => {
    // Half-configured is worse than absent: the button renders, the reader
    // clicks it, and the failure happens on a page we do not own and cannot
    // explain. Both directions, because either half can be the one that is set.
    setEnv({ GOOGLE_CLIENT_ID: 'gid' })
    expect(googleProvider(secrets)).toBeNull()

    setEnv({ GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: 'gsecret' })
    expect(googleProvider(secrets)).toBeNull()
  })

  it('treats blank and whitespace as unset, because that is how CI supplies them', () => {
    // A declared-but-empty variable is the shape a CI secret takes when it is
    // not available to a fork's build. It must read as "not configured", not
    // as a client id of "".
    setEnv({ GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' })
    expect(googleProvider(secrets)).toBeNull()

    setEnv({ GOOGLE_CLIENT_ID: '   ', GOOGLE_CLIENT_SECRET: '   ' })
    expect(googleProvider(secrets)).toBeNull()
  })
})

describe('facebookProvider', () => {
  it('builds a provider when both credentials are present', () => {
    setEnv({ FACEBOOK_CLIENT_ID: 'fid', FACEBOOK_CLIENT_SECRET: 'fsecret' })

    expect(facebookProvider(secrets)?.provider).toBe('facebook')
  })

  it('is configured independently of Google', () => {
    // A deployment with only Facebook set must show exactly one button, not
    // fail because Google is missing.
    setEnv({ FACEBOOK_CLIENT_ID: 'fid', FACEBOOK_CLIENT_SECRET: 'fsecret' })

    expect(facebookProvider(secrets)).not.toBeNull()
    expect(googleProvider(secrets)).toBeNull()
  })

  it('is absent when its secret is missing', () => {
    setEnv({ FACEBOOK_CLIENT_ID: 'fid' })

    expect(facebookProvider(secrets)).toBeNull()
  })
})

describe('appleProvider', () => {
  it('builds a provider only when all four values are present', () => {
    setEnv(APPLE)

    expect(appleProvider(secrets, clock)?.provider).toBe('apple')
  })

  it.each(Object.keys(APPLE))('is absent without %s', (missing) => {
    // Apple's client secret is a JWT we sign, not a string Apple hands over,
    // so "is Apple configured?" is a question about four variables. Checking
    // only for a client secret would report it configured when it cannot
    // possibly sign one, and the failure would land on Apple's error page.
    setEnv({ ...APPLE, [missing]: undefined })

    expect(appleProvider(secrets, clock)).toBeNull()
  })

  it('is absent when nothing is configured', () => {
    expect(appleProvider(secrets, clock)).toBeNull()
  })

  it('treats a blank key as unset', () => {
    setEnv({ ...APPLE, APPLE_PRIVATE_KEY: '  ' })

    expect(appleProvider(secrets, clock)).toBeNull()
  })
})

describe('pkcs8FromEnv', () => {
  it('restores the newlines a dashboard cannot hold', () => {
    // The .p8 key arrives with `\n` escaped because Vercel's environment
    // editor stores one line. Without this, importPKCS8 rejects the PEM at the
    // first sign-in with an error that names neither the key nor the reason.
    expect(pkcs8FromEnv('-----BEGIN PRIVATE KEY-----\\nMIGTAgEA\\n-----END PRIVATE KEY-----'))
      .toBe(`-----BEGIN PRIVATE KEY-----
MIGTAgEA
-----END PRIVATE KEY-----`)
  })

  it('leaves a key that already has real newlines alone', () => {
    // A .p8 pasted into a local .env file with a heredoc already has them, and
    // rewriting it would be a second way to corrupt the same key.
    const pem = '-----BEGIN PRIVATE KEY-----\nMIGTAgEA\n-----END PRIVATE KEY-----'

    expect(pkcs8FromEnv(pem)).toBe(pem)
  })
})
