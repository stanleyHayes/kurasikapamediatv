import { ArticleNotLive, NotPermitted, SchedulePostInPast, articleId } from '@kurasikapa/domain'
import { anApprovedArticle, anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { ArticleNotFound } from '../editorial/errors'
import { FakeClock, SequentialIds } from '../testing/fakes'
import { InMemoryArticleRepository } from '../testing/in-memory-article-repository'
import { FlakySocial, InMemorySocialPostRepository, RecordingSocial } from '../testing/social-fakes'
import { actor } from '../testing/harness'
import { PublishDuePosts } from './publish-due-posts'
import { QueueSocialPost } from './queue-social-post'

const NOW = new Date('2026-08-08T10:00:00Z')
const LATER = new Date('2026-08-08T18:00:00Z')
const EARLIER = new Date('2026-08-08T09:00:00Z')
const target = articleId('art_1')

const manager = actor(['social_media_manager'])
const journalist = actor(['journalist'])

const live = (): ReturnType<typeof anApprovedArticle> =>
  anApprovedArticle({ status: 'published', publishedAt: NOW })

interface QueueDeps {
  readonly posts: InMemorySocialPostRepository
  readonly articles: InMemoryArticleRepository
  readonly clock: FakeClock
  readonly ids: SequentialIds
}

const queueDeps = (articles = [live()]): QueueDeps => ({
  posts: new InMemorySocialPostRepository(),
  articles: new InMemoryArticleRepository(articles),
  clock: new FakeClock(NOW),
  ids: new SequentialIds('sp'),
})

const request = {
  actor: manager,
  articleId: target,
  platforms: ['facebook', 'instagram'] as const,
  caption: 'Budget 2026 explained.',
  scheduledAt: LATER,
}

describe('QueueSocialPost', () => {
  it('queues one post per platform', async () => {
    const d = queueDeps()

    const result = await new QueueSocialPost(d).execute(request)

    expect(result.queued).toHaveLength(2)
  })

  it('refuses a journalist', async () => {
    const d = queueDeps()

    await expect(new QueueSocialPost(d).execute({ ...request, actor: journalist })).rejects.toThrow(
      NotPermitted,
    )
  })

  it('refuses an unpublished article', async () => {
    const d = queueDeps([anArticle()])

    await expect(new QueueSocialPost(d).execute(request)).rejects.toThrow(ArticleNotLive)
  })

  it('reports an unknown article', async () => {
    const d = queueDeps([])

    await expect(new QueueSocialPost(d).execute(request)).rejects.toThrow(ArticleNotFound)
  })

  it('queues nothing at all when the request is bad', async () => {
    // Validating and saving in one pass would leave Facebook queued and
    // Instagram refused — the half-published state a newsroom then has to
    // notice and unpick.
    const d = queueDeps()

    await expect(
      new QueueSocialPost(d).execute({ ...request, scheduledAt: EARLIER }),
    ).rejects.toThrow(SchedulePostInPast)

    const queue = await d.posts.listQueue({ limit: 10 })
    expect(queue.items).toEqual([])
  })
})

describe('PublishDuePosts', () => {
  const ready = async (): Promise<QueueDeps> => {
    const d = queueDeps()
    await new QueueSocialPost(d).execute(request)
    d.clock.set(new Date('2026-08-09T00:00:00Z'))

    return d
  }

  it('sends everything due', async () => {
    const d = await ready()
    const social = new RecordingSocial()

    const result = await new PublishDuePosts({
      posts: d.posts,
      social,
      clock: d.clock,
      siteUrl: 'https://kurasikapa.tv',
    }).execute()

    expect(result.sent).toHaveLength(2)
    expect(social.published.map((t) => t.platform).sort()).toEqual(['facebook', 'instagram'])
  })

  it('sends an absolute URL — the link leaves our domain', async () => {
    const d = await ready()
    const social = new RecordingSocial()

    await new PublishDuePosts({
      posts: d.posts,
      social,
      clock: d.clock,
      siteUrl: 'https://kurasikapa.tv',
    }).execute()

    expect(social.published[0]?.url).toMatch(/^https:\/\/kurasikapa\.tv\//u)
  })

  it('leaves nothing due alone', async () => {
    const d = queueDeps()
    await new QueueSocialPost(d).execute(request)

    const result = await new PublishDuePosts({
      posts: d.posts,
      social: new RecordingSocial(),
      clock: d.clock,
      siteUrl: 'https://kurasikapa.tv',
    }).execute()

    expect(result.sent).toEqual([])
  })
})

describe('one platform failing must not stop the other', () => {
  it('sends Facebook even while Instagram is refusing', async () => {
    // The realistic outage: one expired token, not a total one.
    const d = queueDeps()
    await new QueueSocialPost(d).execute(request)
    d.clock.set(new Date('2026-08-09T00:00:00Z'))

    const social = new FlakySocial('instagram')
    const result = await new PublishDuePosts({
      posts: d.posts,
      social,
      clock: d.clock,
      siteUrl: 'https://kurasikapa.tv',
    }).execute()

    expect(result.sent).toHaveLength(1)
    expect(result.retrying).toHaveLength(1)
    expect(social.published[0]?.platform).toBe('facebook')
  })

  it('abandons a post once its retry budget is spent, and says so', async () => {
    // A post that quietly stopped retrying is a story the newsroom believes
    // went out and did not.
    const d = queueDeps()
    await new QueueSocialPost(d).execute({ ...request, platforms: ['instagram'] })
    d.clock.set(new Date('2026-08-09T00:00:00Z'))

    const worker = new PublishDuePosts({
      posts: d.posts,
      social: new FlakySocial('instagram'),
      clock: d.clock,
      siteUrl: 'https://kurasikapa.tv',
    })

    let last = await worker.execute()
    for (let i = 0; i < 4; i++) last = await worker.execute()

    expect(last.abandoned).toHaveLength(1)
    expect(last.retrying).toEqual([])
  })
})
