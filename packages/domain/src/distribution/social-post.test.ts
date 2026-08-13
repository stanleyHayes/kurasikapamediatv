import { describe, expect, it } from 'vitest'
import { ARTICLE_STATUSES } from '../editorial/article-status'
import { userId } from '../shared/ids'
import { anApprovedArticle, anArticle } from '../testing/builders'
import {
  AlreadySent,
  ArticleNotLive,
  EmptyCaption,
  PLATFORMS,
  SchedulePostInPast,
  SocialPost,
  captionForPlatform,
  socialPostId,
} from './social-post'

const NOW = new Date('2026-08-08T10:00:00Z')
const LATER = new Date('2026-08-08T18:00:00Z')
const EARLIER = new Date('2026-08-08T09:00:00Z')
const EDITOR = userId('usr_social')

const live = (): ReturnType<typeof anApprovedArticle> =>
  anApprovedArticle({ status: 'published', publishedAt: NOW })

const draft = {
  id: socialPostId('sp_1'),
  platform: 'facebook' as const,
  caption: 'Budget 2026 explained — what it means for households.',
  scheduledAt: LATER,
}

const queued = (): SocialPost => SocialPost.queue(draft, live(), EDITOR, NOW)

describe('queue', () => {
  it('queues a post about a published article', () => {
    const post = queued()

    expect(post.state).toBe('queued')
    expect(post.articleId).toBe('art_1')
    expect(post.attempts).toBe(0)
  })

  it('trims the caption', () => {
    const post = SocialPost.queue({ ...draft, caption: '  spaced  ' }, live(), EDITOR, NOW)

    expect(post.caption).toBe('spaced')
  })

  it.each(ARTICLE_STATUSES.filter((s) => s !== 'published'))(
    'refuses an article in state "%s"',
    (status) => {
      // Social reach is the one place a mistake cannot be taken back: an
      // unpublished story announced to Facebook is public whatever the site
      // says afterwards.
      expect(() => SocialPost.queue(draft, anArticle({ status }), EDITOR, NOW)).toThrow(
        ArticleNotLive,
      )
    },
  )

  it('refuses an empty caption', () => {
    expect(() => SocialPost.queue({ ...draft, caption: '   ' }, live(), EDITOR, NOW)).toThrow(
      EmptyCaption,
    )
  })

  it('refuses a moment in the past', () => {
    expect(() =>
      SocialPost.queue({ ...draft, scheduledAt: EARLIER }, live(), EDITOR, NOW),
    ).toThrow(SchedulePostInPast)
  })

  it('accepts the present moment — "post now" is a real request', () => {
    expect(() => SocialPost.queue({ ...draft, scheduledAt: NOW }, live(), EDITOR, NOW)).not.toThrow()
  })

  it.each(PLATFORMS)('queues for %s', (platform) => {
    expect(SocialPost.queue({ ...draft, platform }, live(), EDITOR, NOW).platform).toBe(platform)
  })
})

describe('isDue', () => {
  it('is due once its moment has passed', () => {
    expect(queued().isDue(new Date('2026-08-09T00:00:00Z'))).toBe(true)
  })

  it('is not due before it', () => {
    expect(queued().isDue(NOW)).toBe(false)
  })

  it('is never due once sent', () => {
    expect(queued().markSent().isDue(new Date('2026-08-09T00:00:00Z'))).toBe(false)
  })
})

describe('markSent', () => {
  it('records the send and clears any earlier error', () => {
    const post = queued().markFailed('rate limited').markSent()

    expect(post.state).toBe('sent')
    expect(post.snapshot().lastError).toBeNull()
    expect(post.attempts).toBe(2)
  })

  it('refuses to send twice', () => {
    // Double-posting the same story is visible to every follower.
    expect(() => queued().markSent().markSent()).toThrow(AlreadySent)
  })
})

describe('markFailed — the retry budget', () => {
  it('returns to the queue on an early failure', () => {
    const post = queued().markFailed('network')

    expect(post.state).toBe('queued')
    expect(post.attempts).toBe(1)
    expect(post.needsAttention()).toBe(false)
  })

  it('gives up after five attempts', () => {
    // Retrying forever turns one bad post into permanent load on someone
    // else's API; giving up after one turns a blip into a story nobody saw.
    let post = queued()
    for (let i = 0; i < 5; i++) post = post.markFailed('still failing')

    expect(post.state).toBe('failed')
    expect(post.attempts).toBe(5)
    expect(post.needsAttention()).toBe(true)
  })

  it('keeps the last error for whoever looks', () => {
    expect(queued().markFailed('token expired').snapshot().lastError).toBe('token expired')
  })

  it('refuses to fail something already sent', () => {
    expect(() => queued().markSent().markFailed('late webhook')).toThrow(AlreadySent)
  })

  it('leaves the original untouched', () => {
    const post = queued()
    post.markFailed('network')

    expect(post.attempts).toBe(0)
  })
})

describe('captionForPlatform', () => {
  it('gives a platform its own caption when one was written', () => {
    expect(captionForPlatform('instagram', { instagram: 'Made for IG' }, 'Shared caption')).toBe(
      'Made for IG',
    )
  })

  it('falls back to the shared caption for a platform without one', () => {
    // The override list answers "what differs", not "what repeats" — Facebook
    // gets the shared caption itself, not a copy of it.
    expect(captionForPlatform('facebook', { instagram: 'Made for IG' }, 'Shared caption')).toBe(
      'Shared caption',
    )
  })

  it('treats a blank override as no override', () => {
    expect(captionForPlatform('facebook', { facebook: '   ' }, 'Shared caption')).toBe(
      'Shared caption',
    )
  })

  it('falls back when there are no overrides at all', () => {
    expect(captionForPlatform('facebook', undefined, 'Shared caption')).toBe('Shared caption')
  })
})

describe('reconstitute', () => {
  it('rebuilds from storage without re-applying the queue rules', () => {
    // A post queued yesterday stays queued if the article is pulled today.
    // Cancelling it is a newsroom decision, not a side effect of a read.
    const stored = SocialPost.reconstitute({
      id: socialPostId('sp_stored'),
      articleId: anArticle().id,
      platform: 'instagram',
      caption: 'already queued',
      scheduledAt: LATER,
      state: 'queued',
      attempts: 2,
      lastError: 'earlier failure',
      createdBy: EDITOR,
    })

    expect(stored.scheduledAt).toEqual(LATER)
    expect(stored.attempts).toBe(2)
    expect(stored.caption).toBe('already queued')
  })
})
