import { Like, articleId, userId } from '@kurasikapa/domain'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MongoLikeRepository } from './mongo-like-repository'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness
let repo: MongoLikeRepository

beforeAll(async () => {
  mongo = await startMongo()
  repo = new MongoLikeRepository(mongo.db)
})

afterEach(async () => {
  await mongo.reset()
})

afterAll(async () => {
  await mongo.stop()
})

const like = (reader: string, article: string): Like =>
  Like.reconstitute({
    readerId: userId(reader),
    articleId: articleId(article),
    likedAt: new Date('2026-08-11T10:00:00Z'),
  })

describe('MongoLikeRepository', () => {
  it('round trips a like', async () => {
    await repo.save(like('usr_1', 'art_1'))

    expect(await repo.isLiked(userId('usr_1'), articleId('art_1'))).toBe(true)
    expect(await repo.countFor(articleId('art_1'))).toBe(1)
  })

  it('is idempotent', async () => {
    await repo.save(like('usr_1', 'art_1'))
    await repo.save(like('usr_1', 'art_1'))

    expect(await repo.countFor(articleId('art_1'))).toBe(1)
  })

  it('counts per article', async () => {
    await repo.save(like('usr_1', 'art_1'))
    await repo.save(like('usr_2', 'art_1'))
    await repo.save(like('usr_1', 'art_2'))

    expect(await repo.countFor(articleId('art_1'))).toBe(2)
  })

  it('removes a like', async () => {
    await repo.save(like('usr_1', 'art_1'))
    await repo.remove(userId('usr_1'), articleId('art_1'))

    expect(await repo.isLiked(userId('usr_1'), articleId('art_1'))).toBe(false)
    expect(await repo.countFor(articleId('art_1'))).toBe(0)
  })
})
