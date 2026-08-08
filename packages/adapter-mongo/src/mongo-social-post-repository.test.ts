import { SocialPost, articleId, socialPostId, userId } from '@kurasikapa/domain'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MongoSocialPostRepository } from './mongo-social-post-repository'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness
let repo: MongoSocialPostRepository

beforeAll(async () => {
  mongo = await startMongo()
  repo = new MongoSocialPostRepository(mongo.db)
})

afterEach(async () => {
  await mongo.reset()
})

afterAll(async () => {
  await mongo.stop()
})

const NOW = new Date('2026-08-08T10:00:00Z')
const DUE = new Date('2026-08-08T09:00:00Z')
const LATER = new Date('2026-08-08T18:00:00Z')

const post = (id: string, scheduledAt: Date, state: 'queued' | 'sent' | 'failed' = 'queued'): SocialPost =>
  SocialPost.reconstitute({
    id: socialPostId(id),
    articleId: articleId('art_1'),
    platform: 'facebook',
    caption: 'Budget 2026 explained.',
    scheduledAt,
    state,
    attempts: state === 'queued' ? 0 : 5,
    lastError: state === 'failed' ? 'token expired' : null,
    createdBy: userId('usr_social'),
  })

describe('round trip', () => {
  it('preserves every field', async () => {
    const original = post('sp_1', LATER)
    await repo.save(original)

    const loaded = await repo.findById(socialPostId('sp_1'))

    expect(loaded?.snapshot()).toEqual(original.snapshot())
  })

  it('returns null for an unknown id', async () => {
    expect(await repo.findById(socialPostId('sp_missing'))).toBeNull()
  })

  it('updates in place rather than duplicating', async () => {
    await repo.save(post('sp_1', LATER))
    await repo.save(post('sp_1', LATER).markFailed('network'))

    expect(await mongo.db.collection('social_posts').countDocuments()).toBe(1)
    expect((await repo.findById(socialPostId('sp_1')))?.attempts).toBe(1)
  })
})

describe('listDue', () => {
  it('returns queued posts whose moment has passed', async () => {
    await repo.save(post('sp_due', DUE))
    await repo.save(post('sp_later', LATER))

    const due = await repo.listDue(NOW)

    expect(due.map((p) => p.id)).toEqual(['sp_due'])
  })

  it('excludes a post that exhausted its retries', async () => {
    // A failed post must stay out of the worker's way until a person looks
    // at it — otherwise it is retried forever under a different name.
    await repo.save(post('sp_failed', DUE, 'failed'))

    expect(await repo.listDue(NOW)).toEqual([])
  })

  it('excludes a post already sent', async () => {
    await repo.save(post('sp_sent', DUE, 'sent'))

    expect(await repo.listDue(NOW)).toEqual([])
  })

  it('includes a post due at exactly now', async () => {
    await repo.save(post('sp_exact', NOW))

    expect(await repo.listDue(NOW)).toHaveLength(1)
  })
})

describe('listQueue', () => {
  it('returns everything, soonest first', async () => {
    await repo.save(post('sp_late', LATER))
    await repo.save(post('sp_early', DUE))

    const page = await repo.listQueue({ limit: 10 })

    expect(page.items.map((p) => p.id)).toEqual(['sp_early', 'sp_late'])
  })

  it('shows failed posts too — the queue screen is where they are noticed', async () => {
    await repo.save(post('sp_failed', DUE, 'failed'))

    const page = await repo.listQueue({ limit: 10 })

    expect(page.items[0]?.needsAttention()).toBe(true)
  })

  it('hands out a cursor only when more exist', async () => {
    for (let i = 0; i < 4; i++) await repo.save(post(`sp_${String(i)}`, LATER))

    expect((await repo.listQueue({ limit: 2 })).nextCursor).not.toBeNull()
    expect((await repo.listQueue({ limit: 10 })).nextCursor).toBeNull()
  })
})
