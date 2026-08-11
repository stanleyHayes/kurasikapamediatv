import { Actor, CannotLikeUnpublished, articleId, userId } from '@kurasikapa/domain'
import { anApprovedArticle, anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { ArticleNotFound } from '../editorial/errors'
import { FakeClock } from '../testing/fakes'
import { InMemoryArticleRepository } from '../testing/in-memory-article-repository'
import { InMemoryLikeRepository } from '../testing/in-memory-like-repository'
import { CountLikes } from './count-likes'
import { LikeArticle } from './like-article'
import { UnlikeArticle } from './unlike-article'

const NOW = new Date('2026-08-11T10:00:00Z')
const READER = new Actor(userId('usr_reader'), ['subscriber'])
const OTHER = new Actor(userId('usr_other'), ['subscriber'])
const target = articleId('art_1')

const published = (): ReturnType<typeof anApprovedArticle> =>
  anApprovedArticle({ status: 'published', publishedAt: NOW })

const wiring = (
  articles = [published()],
): {
  readonly likes: InMemoryLikeRepository
  readonly like: LikeArticle
  readonly unlike: UnlikeArticle
  readonly count: CountLikes
} => {
  const likes = new InMemoryLikeRepository()
  return {
    likes,
    like: new LikeArticle({
      likes,
      articles: new InMemoryArticleRepository(articles),
      clock: new FakeClock(NOW),
    }),
    unlike: new UnlikeArticle(likes),
    count: new CountLikes(likes),
  }
}

describe('LikeArticle', () => {
  it('records a like on a published article', async () => {
    const { like, count } = wiring()

    const result = await like.execute({ actor: READER, articleId: target })

    expect(result).toEqual({ liked: true, count: 1 })
    expect(await count.execute({ articleId: target, readerId: READER.id })).toEqual({
      count: 1,
      liked: true,
    })
  })

  it('is idempotent', async () => {
    const { like } = wiring()
    await like.execute({ actor: READER, articleId: target })

    expect(await like.execute({ actor: READER, articleId: target })).toEqual({ liked: true, count: 1 })
  })

  it('refuses an unpublished article', async () => {
    const { like } = wiring([anArticle()])

    await expect(like.execute({ actor: READER, articleId: target })).rejects.toThrow(
      CannotLikeUnpublished,
    )
  })

  it('reports a missing article', async () => {
    const { like } = wiring([])

    await expect(like.execute({ actor: READER, articleId: target })).rejects.toThrow(ArticleNotFound)
  })
})

describe('UnlikeArticle', () => {
  it('removes only this reader’s like', async () => {
    const { like, unlike, count } = wiring()
    await like.execute({ actor: READER, articleId: target })
    await like.execute({ actor: OTHER, articleId: target })

    expect(await unlike.execute({ actor: READER, articleId: target })).toEqual({
      liked: false,
      count: 1,
    })
    expect(await count.execute({ articleId: target, readerId: OTHER.id })).toEqual({
      count: 1,
      liked: true,
    })
  })

  it('succeeds when nothing was liked', async () => {
    const { unlike } = wiring()

    expect(await unlike.execute({ actor: READER, articleId: target })).toEqual({
      liked: false,
      count: 0,
    })
  })
})

describe('CountLikes', () => {
  it('reports not liked for a signed-out reader', async () => {
    const { like, count } = wiring()
    await like.execute({ actor: READER, articleId: target })

    expect(await count.execute({ articleId: target })).toEqual({ count: 1, liked: false })
  })
})
