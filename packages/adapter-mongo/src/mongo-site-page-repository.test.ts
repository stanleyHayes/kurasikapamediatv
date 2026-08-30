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
    const page = SitePage.create({ key: 'careers', locale: 'en', title: 'Careers', lead: 'Join us', body: 'Independent reporting.', updatedAt: new Date('2026-08-30T20:00:00Z') })
    await repo.save(page)
    expect((await repo.find('careers', 'en'))?.snapshot()).toEqual(page.snapshot())
    expect(await repo.find('careers', 'fr')).toBeNull()
  })

  it('lists one locale in key order', async () => {
    await repo.save(SitePage.create({ key: 'faq', locale: 'en', title: 'FAQ', lead: '', body: 'Answers', updatedAt: new Date() }))
    await repo.save(SitePage.create({ key: 'careers', locale: 'en', title: 'Careers', lead: '', body: 'Purpose', updatedAt: new Date() }))
    await repo.save(SitePage.create({ key: 'careers', locale: 'fr', title: 'Carrières', lead: '', body: 'Mission', updatedAt: new Date() }))
    expect((await repo.list('en')).map((page) => page.snapshot().key)).toEqual(['careers', 'faq'])
  })
})
