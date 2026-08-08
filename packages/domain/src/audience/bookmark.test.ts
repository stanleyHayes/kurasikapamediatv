import { describe, expect, it } from 'vitest'
import { ARTICLE_STATUSES } from '../editorial/article-status'
import { userId } from '../shared/ids'
import { anApprovedArticle, anArticle } from '../testing/builders'
import { Bookmark, CannotSaveUnpublished } from './bookmark'

const READER = userId('usr_reader')
const NOW = new Date('2026-08-08T10:00:00Z')

const published = (): ReturnType<typeof anApprovedArticle> =>
  anApprovedArticle({ status: 'published', publishedAt: NOW })

describe('create', () => {
  it('saves a published article for a reader', () => {
    const bookmark = Bookmark.create(READER, published(), NOW)

    expect(bookmark.readerId).toBe(READER)
    expect(bookmark.articleId).toBe('art_1')
    expect(bookmark.savedAt).toEqual(NOW)
  })

  it('records the locale the reader actually saved', () => {
    // An article family has one entry per language; "saved the article" is
    // ambiguous, "saved the French one" is not.
    const bookmark = Bookmark.create(READER, published(), NOW)

    expect(bookmark.locale).toBe('en')
  })

  it.each(ARTICLE_STATUSES.filter((s) => s !== 'published'))(
    'refuses to save an article in state "%s"',
    (status) => {
      // Otherwise a reader who learned a draft's id could keep a handle on it
      // and watch for the moment it appears.
      expect(() => Bookmark.create(READER, anArticle({ status }), NOW)).toThrow(
        CannotSaveUnpublished,
      )
    },
  )

  it('names the article it refused', () => {
    expect(() => Bookmark.create(READER, anArticle(), NOW)).toThrow(/art_1/u)
  })
})

describe('belongsTo', () => {
  it('recognises its own reader', () => {
    expect(Bookmark.create(READER, published(), NOW).belongsTo(READER)).toBe(true)
  })

  it('refuses another reader', () => {
    const other = userId('usr_other')

    expect(Bookmark.create(READER, published(), NOW).belongsTo(other)).toBe(false)
  })
})

describe('reconstitute', () => {
  it('rebuilds from storage without re-applying the publish rule', () => {
    // A bookmark saved yesterday stays valid if the article is pulled today.
    // Removing it is a decision for the newsroom, not a side effect of a read.
    const stored = Bookmark.reconstitute({
      readerId: READER,
      articleId: anArticle().id,
      locale: 'fr',
      savedAt: NOW,
    })

    expect(stored.locale).toBe('fr')
    expect(stored.snapshot().readerId).toBe(READER)
  })
})
