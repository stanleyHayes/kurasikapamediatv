import { describe, expect, it } from 'vitest'
import { parse } from './env'

const valid = {
  MONGODB_URI: 'mongodb://localhost:27017/x',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
}

describe('env', () => {
  it('accepts the minimum viable configuration', () => {
    expect(parse(valid).MONGODB_URI).toBe('mongodb://localhost:27017/x')
  })

  it('defaults the database name and locale', () => {
    const env = parse(valid)
    expect(env.MONGODB_DB).toBe('kurasikapa')
    expect(env.DEFAULT_LOCALE).toBe('en')
  })

  it('fails at boot, naming what is missing', () => {
    // A missing URI must surface here with a readable message, not as a
    // connection error inside a reader's first request.
    expect(() => parse({})).toThrow(/MONGODB_URI/u)
    expect(() => parse({})).toThrow(/\.env\.example/u)
  })

  it('rejects an empty string, which is not the same as unset', () => {
    expect(() => parse({ ...valid, MONGODB_URI: '' })).toThrow(/MONGODB_URI/u)
  })

  it('refuses a short auth secret', () => {
    // The secret signs session cookies. A weak one compromises every account,
    // and it is exactly the value someone sets to "changeme" in a hurry.
    expect(() => parse({ ...valid, BETTER_AUTH_SECRET: 'short' })).toThrow(/BETTER_AUTH_SECRET/u)
  })

  it('defaults to development, so secure cookies are opt-in for production', () => {
    expect(parse(valid).NODE_ENV).toBe('development')
  })

  it('treats the AI key as optional, so the public site boots without it', () => {
    expect(parse(valid).ANTHROPIC_API_KEY).toBeUndefined()
  })

  it('treats API_URL as optional — unset keeps create-draft on TypeScript', () => {
    expect(parse(valid).API_URL).toBeUndefined()
  })

  it('treats blank AWS credentials as disabled so live video fails closed', () => {
    const env = parse({ ...valid, AWS_ACCESS_KEY_ID: '', AWS_SECRET_ACCESS_KEY: '' })
    expect(env.AWS_ACCESS_KEY_ID).toBeUndefined()
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined()
  })

  it('requires both AWS credentials and a deliberate region', () => {
    expect(() => parse({ ...valid, AWS_ACCESS_KEY_ID: 'access' })).toThrow(/AWS_ACCESS_KEY_ID/u)
    expect(() => parse({ ...valid, AWS_ACCESS_KEY_ID: 'access', AWS_SECRET_ACCESS_KEY: 'secret' })).toThrow(/AWS_REGION/u)
    expect(parse({ ...valid, AWS_REGION: 'eu-west-3', AWS_ACCESS_KEY_ID: 'access', AWS_SECRET_ACCESS_KEY: 'secret' }).AWS_REGION).toBe('eu-west-3')
  })

  it('accepts an API_URL when the Go service is reachable', () => {
    expect(parse({ ...valid, API_URL: 'http://localhost:8080' }).API_URL).toBe(
      'http://localhost:8080',
    )
  })
})
