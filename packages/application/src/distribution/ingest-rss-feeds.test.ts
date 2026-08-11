import { NotPermitted, RssSource, categoryId } from '@kurasikapa/domain'
import { describe, expect, it } from 'vitest'
import { CreateDraft } from '../editorial/create-draft'
import { anAuthor, anEditor, harness, theSystem } from '../testing/harness'
import { FailClosedRssFeed, RecordingRssFeed, anEntry } from '../testing/fake-rss'
import { InMemoryRssSourceRepository } from '../testing/in-memory-rss-source-repository'
import { IngestRssFeeds } from './ingest-rss-feeds'
import { RegisterRssSource } from './register-rss-source'

const CATEGORY = categoryId('cat_wire')
const FEED = 'https://wire.example/feed.xml'

const wiring = (
  feed: RecordingRssFeed | FailClosedRssFeed = new RecordingRssFeed({
    entries: [anEntry('g1'), anEntry('g2', 'Second item')],
    etag: '"v1"',
  }),
): {
  readonly sources: InMemoryRssSourceRepository
  readonly ingest: IngestRssFeeds
  readonly register: RegisterRssSource
  readonly articles: ReturnType<typeof harness>['articles']
} => {
  const h = harness()
  const sources = new InMemoryRssSourceRepository()
  return {
    sources,
    articles: h.articles,
    register: new RegisterRssSource(sources, h.ids),
    ingest: new IngestRssFeeds({
      sources,
      feed,
      drafts: new CreateDraft(h),
      clock: h.clock,
    }),
  }
}

describe('RegisterRssSource', () => {
  it('stores a feed the editor registered', async () => {
    const { register, sources } = wiring()
    const result = await register.execute({
      actor: anEditor,
      url: FEED,
      locale: 'en',
      categoryId: CATEGORY,
    })

    expect(result.id).toBeTruthy()
    expect((await sources.list())[0]?.url).toBe(FEED)
  })

  it('refuses an author', async () => {
    await expect(
      wiring().register.execute({
        actor: anAuthor,
        url: FEED,
        locale: 'en',
        categoryId: CATEGORY,
      }),
    ).rejects.toThrow(NotPermitted)
  })
})

describe('IngestRssFeeds', () => {
  it('opens drafts for unseen items and does not publish them', async () => {
    const { register, ingest, articles } = wiring()
    await register.execute({ actor: anEditor, url: FEED, locale: 'en', categoryId: CATEGORY })

    const result = await ingest.execute({ actor: theSystem })
    const stored = await articles.listAuthoredBy({ authorId: theSystem.id, limit: 20 })

    expect(result.drafted).toBe(2)
    expect(stored.items.every((row) => row.status === 'draft')).toBe(true)
  })

  it('does not draft the same guid twice', async () => {
    const { register, ingest } = wiring()
    await register.execute({ actor: anEditor, url: FEED, locale: 'en', categoryId: CATEGORY })

    await ingest.execute({ actor: theSystem })
    expect(await ingest.execute({ actor: theSystem })).toEqual({ drafted: 0 })
  })

  it('skips a feed that cannot be fetched', async () => {
    const sources = new InMemoryRssSourceRepository()
    await sources.save(
      RssSource.register({ id: 'rss_1', url: FEED, locale: 'en', categoryId: CATEGORY }),
    )
    const ingest = new IngestRssFeeds({
      sources,
      feed: new FailClosedRssFeed(),
      drafts: new CreateDraft(harness()),
      clock: harness().clock,
    })

    expect(await ingest.execute({ actor: theSystem })).toEqual({ drafted: 0 })
  })
})
