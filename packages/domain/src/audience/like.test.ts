import { describe, expect, it } from 'vitest'
import { ARTICLE_STATUSES } from '../editorial/article-status'
import { userId } from '../shared/ids'
import { anApprovedArticle, anArticle } from '../testing/builders'
import { CannotLikeUnpublished, Like } from './like'

const READER = userId('usr_reader')
const NOW = new Date('2026-08-11T10:00:00Z')

const published = (): ReturnType<typeof anApprovedArticle> =>
  anApprovedArticle({ status: 'published', publishedAt: NOW })

describe('Like.create', () => {
  it('likes a published article', () => {
    const like = Like.create(READER, published(), NOW)

    expect(like.readerId).toBe(READER)
    expect(like.articleId).toBe(published().id)
    expect(like.likedAt).toEqual(NOW)
    expect(Like.reconstitute(like.snapshot()).readerId).toBe(READER)
  })

  it.each(ARTICLE_STATUSES.filter((s) => s !== 'published'))(
    'refuses to like an article in state "%s"',
    (status) => {
      expect(() => Like.create(READER, anArticle({ status }), NOW)).toThrow(CannotLikeUnpublished)
    },
  )
})
