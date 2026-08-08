import { describe, expect, it } from 'vitest'
import { parse } from './env'

const valid = { MONGODB_URI: 'mongodb://localhost:27017/x' }

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
    expect(() => parse({ MONGODB_URI: '' })).toThrow(/MONGODB_URI/u)
  })

  it('treats the AI key as optional, so the public site boots without it', () => {
    expect(parse(valid).ANTHROPIC_API_KEY).toBeUndefined()
  })
})
