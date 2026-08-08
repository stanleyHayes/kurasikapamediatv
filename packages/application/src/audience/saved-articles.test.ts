import {
  Actor,
  Bookmark,
  CannotSaveUnpublished,
  articleId,
  familyId,
  userId,
} from '@kurasikapa/domain'
import { anApprovedArticle, anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { ArticleNotFound } from '../editorial/errors'
import { FakeClock } from '../testing/fakes'
import { InMemoryArticleRepository } from '../testing/in-memory-article-repository'
import { InMemoryBookmarkRepository } from '../testing/in-memory-bookmark-repository'
import { ListSavedArticles, RemoveSavedArticle } from './manage-saved-articles'
import { SaveArticle } from './save-article'

const NOW = new Date('2026-08-08T10:00:00Z')
const READER = new Actor(userId('usr_reader'), ['subscriber'])
const OTHER = new Actor(userId('usr_other'), ['subscriber'])
const target = articleId('art_1')

const published = (): ReturnType<typeof anApprovedArticle> =>
  anApprovedArticle({ status: 'published', publishedAt: NOW })

interface Deps {
  readonly bookmarks: InMemoryBookmarkRepository
  readonly articles: InMemoryArticleRepository
  readonly clock: FakeClock
}

const deps = (articles = [published()]): Deps => ({
  bookmarks: new InMemoryBookmarkRepository(),
  articles: new InMemoryArticleRepository(articles),
  clock: new FakeClock(NOW),
})

describe('SaveArticle', () => {
  it('saves a published article for the reader', async () => {
    const d = deps()

    await new SaveArticle(d).execute({ actor: READER, articleId: target })

    expect(await d.bookmarks.isSaved(READER.id, target)).toBe(true)
  })

  it('is idempotent — a double tap is not a failure', async () => {
    const d = deps()
    const save = new SaveArticle(d)

    await save.execute({ actor: READER, articleId: target })
    await save.execute({ actor: READER, articleId: target })

    expect(d.bookmarks.count()).toBe(1)
  })

  it('refuses an unpublished article', async () => {
    // A reader who learned a draft's id must not be able to hold a handle on
    // it and watch for the moment it appears.
    const d = deps([anArticle()])

    await expect(new SaveArticle(d).execute({ actor: READER, articleId: target })).rejects.toThrow(
      CannotSaveUnpublished,
    )
  })

  it('reports an unknown article', async () => {
    const d = deps([])

    await expect(new SaveArticle(d).execute({ actor: READER, articleId: target })).rejects.toThrow(
      ArticleNotFound,
    )
  })

  it('stamps the injected clock', async () => {
    const d = deps()
    await new SaveArticle(d).execute({ actor: READER, articleId: target })

    const page = await d.bookmarks.listFor(READER.id, { limit: 10 })

    expect(page.items[0]?.savedAt).toEqual(NOW)
  })
})

describe('reader lists never cross', () => {
  it('shows a reader only their own saves', async () => {
    const d = deps()
    const save = new SaveArticle(d)

    await save.execute({ actor: READER, articleId: target })

    const theirs = await new ListSavedArticles(d).execute({ actor: OTHER })

    expect(theirs.items).toEqual([])
  })

  it('takes no reader id, so a query string cannot redirect it', async () => {
    // What someone reads is among the most sensitive data this platform holds.
    const d = deps()
    await new SaveArticle(d).execute({ actor: READER, articleId: target })

    const mine = await new ListSavedArticles(d).execute({ actor: READER })

    expect(mine.items).toHaveLength(1)
    expect(mine.items[0]?.id).toBe(target)
  })

  it('removes only the actor’s own bookmark', async () => {
    const d = deps()
    await d.bookmarks.save(Bookmark.create(OTHER.id, published(), NOW))
    await new SaveArticle(d).execute({ actor: READER, articleId: target })

    await new RemoveSavedArticle(d).execute({ actor: READER, articleId: target })

    expect(await d.bookmarks.isSaved(READER.id, target)).toBe(false)
    expect(await d.bookmarks.isSaved(OTHER.id, target)).toBe(true)
  })
})

describe('RemoveSavedArticle', () => {
  it('succeeds for something never saved — un-saving is an end state', async () => {
    const d = deps()

    await expect(
      new RemoveSavedArticle(d).execute({ actor: READER, articleId: target }),
    ).resolves.toEqual({ saved: false })
  })
})

describe('ListSavedArticles', () => {
  it('returns newest first', async () => {
    const d = deps([
      published(),
      anApprovedArticle({
        id: articleId('art_2'),
        familyId: familyId('fam_2'),
        status: 'published',
        publishedAt: NOW,
      }),
    ])

    await d.bookmarks.save(Bookmark.reconstitute({
      readerId: READER.id,
      articleId: target,
      locale: 'en',
      savedAt: new Date('2026-08-01T00:00:00Z'),
    }))
    await d.bookmarks.save(Bookmark.reconstitute({
      readerId: READER.id,
      articleId: articleId('art_2'),
      locale: 'en',
      savedAt: new Date('2026-08-07T00:00:00Z'),
    }))

    const page = await new ListSavedArticles(d).execute({ actor: READER })

    expect(page.items.map((a) => a.id)).toEqual(['art_2', 'art_1'])
  })

  it.each([
    ['an absent', undefined, 20],
    ['a zero', 0, 20],
    ['an absurd', 100_000, 100],
  ])('maps %s limit to %i', async (_label, requested, expected) => {
    const d = deps()
    const seen: number[] = []
    const original = d.bookmarks.listFor.bind(d.bookmarks)
    d.bookmarks.listFor = (reader, cursor): ReturnType<typeof original> => {
      seen.push(cursor.limit)
      return original(reader, cursor)
    }

    await new ListSavedArticles(d).execute({ actor: READER, limit: requested })

    expect(seen).toEqual([expected])
  })
})
