import { NewsletterDigest } from '@kurasikapa/domain'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MongoNewsletterDigestRepository } from './mongo-newsletter-digest-repository'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness
let repo: MongoNewsletterDigestRepository

beforeAll(async () => {
  mongo = await startMongo()
  repo = new MongoNewsletterDigestRepository(mongo.db)
})

afterEach(async () => {
  await mongo.reset()
})

afterAll(async () => {
  await mongo.stop()
})

const digest = (): NewsletterDigest =>
  NewsletterDigest.issue({
    cadence: 'daily',
    locale: 'en',
    periodKey: '2026-08-12',
    now: new Date('2026-08-12T08:00:00Z'),
    articleCount: 3,
    recipientCount: 42,
  })

describe('MongoNewsletterDigestRepository', () => {
  it('round trips by id', async () => {
    await repo.save(digest())

    const found = await repo.findById('daily:en:2026-08-12')
    expect(found?.snapshot()).toMatchObject({
      cadence: 'daily',
      locale: 'en',
      periodKey: '2026-08-12',
      articleCount: 3,
      recipientCount: 42,
    })
    expect(await repo.findById('daily:en:2026-08-13')).toBeNull()
  })

  it('refuses a duplicate send', async () => {
    await repo.save(digest())

    await expect(repo.save(digest())).rejects.toThrow()
  })
})
