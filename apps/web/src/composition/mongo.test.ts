import { afterEach, describe, expect, it } from 'vitest'
import { resetEnv } from './env'
import { closeMongo, mongoClient, mongoDb } from './mongo'

// The driver does not connect on construction, so these run with no database.
process.env['MONGODB_URI'] = 'mongodb://127.0.0.1:27017/kurasikapa_unit'
process.env['BETTER_AUTH_SECRET'] = 'x'.repeat(32)

afterEach(async () => {
  await closeMongo()
  resetEnv()
})

describe('mongoClient', () => {
  it('returns the same client across calls', () => {
    // A client per request would defeat the driver's own pooling and exhaust
    // connections under load on warm serverless invocations.
    expect(mongoClient()).toBe(mongoClient())
  })

  it('builds a fresh client after close, so shutdown is recoverable', async () => {
    const first = mongoClient()
    await closeMongo()

    expect(mongoClient()).not.toBe(first)
  })
})

describe('mongoDb', () => {
  it('uses the configured database name', () => {
    expect(mongoDb().databaseName).toBe('kurasikapa')
  })
})
