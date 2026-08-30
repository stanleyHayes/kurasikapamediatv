import { SitePage } from '@kurasikapa/domain'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MongoSitePageRepository } from './mongo-site-page-repository'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness
let repo: MongoSitePageRepository

beforeAll(async () => { mongo = await startMongo(); repo = new MongoSitePageRepository(mongo.db) })
afterEach(async () => { await mongo.reset() })
afterAll(async () => { await mongo.stop() })

describe('MongoSitePageRepository', () => {
  it('upserts and returns localized content', async () => {
    const page = SitePage.create({ key: 'about', locale: 'en', title: 'About', lead: 'Our purpose', body: 'Independent reporting.', updatedAt: new Date('2026-08-30T20:00:00Z') })
    await repo.save(page)
    expect((await repo.find('about', 'en'))?.snapshot()).toEqual(page.snapshot())
    expect(await repo.find('about', 'fr')).toBeNull()
  })

  it('lists one locale in key order', async () => {
    await repo.save(SitePage.create({ key: 'team', locale: 'en', title: 'Team', lead: '', body: 'People', updatedAt: new Date() }))
    await repo.save(SitePage.create({ key: 'about', locale: 'en', title: 'About', lead: '', body: 'Purpose', updatedAt: new Date() }))
    await repo.save(SitePage.create({ key: 'about', locale: 'fr', title: 'A propos', lead: '', body: 'Mission', updatedAt: new Date() }))
    expect((await repo.list('en')).map((page) => page.snapshot().key)).toEqual(['about', 'team'])
  })
})
