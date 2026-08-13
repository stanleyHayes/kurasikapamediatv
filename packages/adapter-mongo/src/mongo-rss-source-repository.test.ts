import { RssSource, categoryId } from '@kurasikapa/domain'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MongoRssSourceRepository } from './mongo-rss-source-repository'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness
let repo: MongoRssSourceRepository

beforeAll(async () => {
  mongo = await startMongo()
  repo = new MongoRssSourceRepository(mongo.db)
})

afterEach(async () => {
  await mongo.reset()
})

afterAll(async () => {
  await mongo.stop()
})

const source = (): RssSource =>
  RssSource.register({
    id: 'src_1',
    url: 'https://example.com/feed.xml',
    locale: 'en',
    categoryId: categoryId('cat_news'),
  })

describe('MongoRssSourceRepository', () => {
  it('round trips and lists', async () => {
    await repo.save(source())

    const rows = await repo.list()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.url).toBe('https://example.com/feed.xml')
    expect(rows[0]?.locale).toBe('en')
    expect(rows[0]?.etag).toBeNull()
  })

  it('remembers guids and fetch metadata', async () => {
    await repo.save(
      source().remember('guid_1').fetched('etag_1', new Date('2026-08-12T09:00:00Z')),
    )

    const rows = await repo.list()
    expect(rows[0]?.seen('guid_1')).toBe(true)
    expect(rows[0]?.etag).toBe('etag_1')
  })

  it('upserts on the same id', async () => {
    await repo.save(source())
    await repo.save(source().remember('guid_1'))

    expect(await repo.list()).toHaveLength(1)
  })
})
