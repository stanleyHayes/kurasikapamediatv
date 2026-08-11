import { NewsletterSubscription } from '@kurasikapa/domain'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MongoNewsletterRepository } from './mongo-newsletter-repository'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness
let repo: MongoNewsletterRepository

beforeAll(async () => {
  mongo = await startMongo()
  repo = new MongoNewsletterRepository(mongo.db)
})

afterEach(async () => {
  await mongo.reset()
})

afterAll(async () => {
  await mongo.stop()
})

const pending = (): NewsletterSubscription =>
  NewsletterSubscription.request({
    id: 'sub_1',
    email: 'editor@kurasikapa.tv',
    locales: ['en'],
    cadence: 'daily',
    token: 'tok_1',
  })

describe('MongoNewsletterRepository', () => {
  it('round trips by email and token', async () => {
    await repo.save(pending())

    expect((await repo.findByEmail('editor@kurasikapa.tv'))?.token).toBe('tok_1')
    expect((await repo.findByToken('tok_1'))?.email).toBe('editor@kurasikapa.tv')
  })

  it('returns null when missing', async () => {
    expect(await repo.findByEmail('nobody@kurasikapa.tv')).toBeNull()
    expect(await repo.findByToken('missing')).toBeNull()
  })

  it('lists only confirmed subscribers for a locale', async () => {
    const en = NewsletterSubscription.request({
      id: 'sub_en',
      email: 'en@kurasikapa.tv',
      locales: ['en'],
      cadence: 'daily',
      token: 'tok_en',
    }).confirm('tok_en', new Date('2026-08-11T12:00:00Z'))
    const fr = NewsletterSubscription.request({
      id: 'sub_fr',
      email: 'fr@kurasikapa.tv',
      locales: ['fr'],
      cadence: 'weekly',
      token: 'tok_fr',
    }).confirm('tok_fr', new Date('2026-08-11T12:00:00Z'))
    await repo.save(en)
    await repo.save(fr)
    await repo.save(pending())

    expect((await repo.listConfirmed('en')).map((row) => row.email)).toEqual(['en@kurasikapa.tv'])
  })

  it('replaces the token on the same address', async () => {
    await repo.save(pending())
    await repo.save(pending().retoken('tok_2'))

    expect((await repo.findByEmail('editor@kurasikapa.tv'))?.token).toBe('tok_2')
    expect(await repo.findByToken('tok_1')).toBeNull()
  })
})
