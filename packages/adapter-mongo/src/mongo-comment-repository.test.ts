import { Comment, articleId, commentId, userId } from '@kurasikapa/domain'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MongoCommentRepository } from './mongo-comment-repository'
import { type CommentDocument } from './documents'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness
let repo: MongoCommentRepository

beforeAll(async () => {
  mongo = await startMongo()
  repo = new MongoCommentRepository(mongo.db)
})

afterEach(async () => {
  await mongo.reset()
})

afterAll(async () => {
  await mongo.stop()
})

const row = (id: string, state: 'pending' | 'visible' | 'rejected', at: string): Comment =>
  Comment.reconstitute({
    id: commentId(id),
    articleId: articleId('art_1'),
    readerId: userId('usr_reader'),
    body: id,
    state,
    createdAt: new Date(at),
  })

describe('MongoCommentRepository', () => {
  it('round trips a comment', async () => {
    await repo.save(row('cmt_1', 'pending', '2026-08-11T10:00:00Z'))

    expect((await repo.findById(commentId('cmt_1')))?.body).toBe('cmt_1')
  })

  it('lists only visible remarks for an article', async () => {
    await repo.save(row('cmt_p', 'pending', '2026-08-11T10:00:00Z'))
    await repo.save(row('cmt_v', 'visible', '2026-08-11T11:00:00Z'))

    const page = await repo.listVisible(articleId('art_1'), { limit: 10 })
    expect(page.items.map((c) => c.id)).toEqual(['cmt_v'])
  })

  it('lists pending oldest first', async () => {
    await repo.save(row('cmt_new', 'pending', '2026-08-11T12:00:00Z'))
    await repo.save(row('cmt_old', 'pending', '2026-08-11T09:00:00Z'))

    const page = await repo.listPending({ limit: 10 })
    expect(page.items.map((c) => c.id)).toEqual(['cmt_old', 'cmt_new'])
  })

  it('returns null for a missing id', async () => {
    expect(await repo.findById(commentId('cmt_none'))).toBeNull()
  })

  it('round trips a rejected comment', async () => {
    await repo.save(row('cmt_r', 'rejected', '2026-08-11T10:00:00Z'))

    expect((await repo.findById(commentId('cmt_r')))?.state).toBe('rejected')
  })

  it('pages visible newest first', async () => {
    await repo.save(row('cmt_a', 'visible', '2026-08-11T10:00:00Z'))
    await repo.save(row('cmt_b', 'visible', '2026-08-11T11:00:00Z'))
    await repo.save(row('cmt_c', 'visible', '2026-08-11T12:00:00Z'))

    const first = await repo.listVisible(articleId('art_1'), { limit: 2 })
    expect(first.items.map((c) => c.id)).toEqual(['cmt_c', 'cmt_b'])
    expect(first.nextCursor).toBe('cmt_b')

    const next = await repo.listVisible(articleId('art_1'), {
      limit: 2,
      after: first.nextCursor ?? undefined,
    })
    expect(next.items.map((c) => c.id)).toEqual(['cmt_a'])
    expect(next.nextCursor).toBeNull()
  })

  it('pages pending oldest first', async () => {
    await repo.save(row('cmt_a', 'pending', '2026-08-11T10:00:00Z'))
    await repo.save(row('cmt_b', 'pending', '2026-08-11T11:00:00Z'))
    await repo.save(row('cmt_c', 'pending', '2026-08-11T12:00:00Z'))

    const first = await repo.listPending({ limit: 2 })
    expect(first.items.map((c) => c.id)).toEqual(['cmt_a', 'cmt_b'])

    const next = await repo.listPending({ limit: 2, after: first.nextCursor ?? undefined })
    expect(next.items.map((c) => c.id)).toEqual(['cmt_c'])
  })

  it('refuses an unknown stored state', async () => {
    await mongo.db.collection<CommentDocument>('comments').insertOne({
      _id: 'cmt_bad',
      articleId: 'art_1',
      readerId: 'usr_reader',
      body: 'x',
      state: 'spam',
      createdAt: new Date('2026-08-11T10:00:00Z'),
    })

    await expect(repo.findById(commentId('cmt_bad'))).rejects.toThrow(/Unknown comment state/u)
  })
})
