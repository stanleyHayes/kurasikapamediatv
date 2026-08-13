import { describe, expect, it } from 'vitest'
import { invalidateFor } from './cache-invalidation'
import {
  RevalidationNotConfigured,
  RevalidationRejected,
  collectingTags,
  parseInvalidations,
  postInvalidations,
} from './revalidation'

const SECRET = 'r'.repeat(32)
const SITE = 'https://kurasikapa.tv'

/** A fetch stand-in that records the one call it is given. */
function recordingFetch(response = new Response('{}', { status: 200 })): {
  fetchImpl: typeof fetch
  calls: { url: string; init: RequestInit | undefined }[]
} {
  const calls: { url: string; init: RequestInit | undefined }[] = []

  return {
    calls,
    fetchImpl: ((url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return Promise.resolve(response)
    }) as unknown as typeof fetch,
  }
}

describe('collectingTags', () => {
  it('records what invalidateFor decides, instead of touching next/cache', () => {
    const { tags, drain } = collectingTags()

    invalidateFor(tags, { name: 'article.published', articleId: 'a1', locale: 'en' } as never)

    expect(drain()).toStrictEqual(['article-a1', 'articles-en'])
  })

  it('collapses a repeated tag into one invalidation', () => {
    const { tags, drain } = collectingTags()
    tags.update('article-a1')
    tags.revalidate('article-a1')

    // One tag, one round trip. The urgency distinction it used to carry only
    // meant anything within a single deployment's request.
    expect(drain()).toStrictEqual(['article-a1'])
  })

  it('drains, so a second read does not resend the first publish', () => {
    const { tags, drain } = collectingTags()
    tags.update('article-a1')

    expect(drain()).toHaveLength(1)
    expect(drain()).toStrictEqual([])
  })
})

describe('postInvalidations', () => {
  it('posts the tags to the site, bearing the shared secret', async () => {
    const { fetchImpl, calls } = recordingFetch()

    await postInvalidations({ siteUrl: SITE, secret: SECRET, tags: ['article-a1'], fetchImpl })

    expect(calls[0]?.url).toBe('https://kurasikapa.tv/api/revalidate')
    const headers = calls[0]?.init?.headers as Record<string, string>
    expect(headers['authorization']).toBe(`Bearer ${SECRET}`)
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ tags: ['article-a1'] }))
  })

  it('never lets the response be cached', async () => {
    const { fetchImpl, calls } = recordingFetch()

    await postInvalidations({ siteUrl: SITE, secret: SECRET, tags: ['article-a1'], fetchImpl })

    // A cached 200 would mean the second publish of the day silently did
    // nothing, which is the exact failure this whole seam exists to prevent.
    expect(calls[0]?.init?.cache).toBe('no-store')
  })

  it('bounds the wait, because an editor is on the other end of it', async () => {
    const { fetchImpl, calls } = recordingFetch()

    await postInvalidations({ siteUrl: SITE, secret: SECRET, tags: ['article-a1'], fetchImpl })

    // Awaited inside the publish action: without a deadline, an unresponsive
    // site turns "the site did not refresh" into "publishing is broken".
    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('says nothing when there is nothing to say', async () => {
    const { fetchImpl, calls } = recordingFetch()

    await postInvalidations({ siteUrl: SITE, secret: SECRET, tags: [], fetchImpl })

    // An approval or a rejection changes nothing a reader can see. Posting an
    // empty list on every editorial event would be a request per keystroke.
    expect(calls).toHaveLength(0)
  })

  it('refuses to pretend it published when the secret is unset', async () => {
    const { fetchImpl, calls } = recordingFetch()

    // Fail LOUDLY, not closed-and-quiet: the article is genuinely published,
    // so the publish must not be rolled back — but a permanently stale public
    // site is not something to discover from a reader's complaint.
    await expect(
      postInvalidations({ siteUrl: SITE, secret: undefined, tags: ['article-a1'], fetchImpl }),
    ).rejects.toBeInstanceOf(RevalidationNotConfigured)
    expect(calls).toHaveLength(0)
  })

  it('treats an empty secret as unset, because it is', async () => {
    const { fetchImpl } = recordingFetch()

    await expect(
      postInvalidations({ siteUrl: SITE, secret: '', tags: ['article-a1'], fetchImpl }),
    ).rejects.toBeInstanceOf(RevalidationNotConfigured)
  })

  it('reports a refusal from the site rather than shrugging', async () => {
    const { fetchImpl } = recordingFetch(new Response('Not found', { status: 404 }))

    // 404 is what the site returns for a wrong secret. Silently accepting it
    // would leave the two deployments disagreeing with nobody the wiser.
    await expect(
      postInvalidations({ siteUrl: SITE, secret: SECRET, tags: ['article-a1'], fetchImpl }),
    ).rejects.toBeInstanceOf(RevalidationRejected)
  })
})

describe('parseInvalidations', () => {
  it('accepts a well-formed payload', () => {
    expect(parseInvalidations({ tags: ['article-a1', 'articles-en'] })).toStrictEqual([
      'article-a1',
      'articles-en',
    ])
  })

  it('drops entries it cannot vouch for', () => {
    // The body arrives over the network. A non-string or an empty tag is a
    // caller bug or an attacker; either way this route will not act on it.
    expect(parseInvalidations({ tags: ['article-a1', '', 42, null, {}] })).toStrictEqual([
      'article-a1',
    ])
  })

  it('survives a body that is not the shape it claims', () => {
    // `request.json()` returns whatever was sent. Every one of these reached
    // the property read and threw before the guard was total.
    expect(parseInvalidations(null)).toStrictEqual([])
    expect(parseInvalidations(undefined)).toStrictEqual([])
    expect(parseInvalidations('all')).toStrictEqual([])
    expect(parseInvalidations([])).toStrictEqual([])
    expect(parseInvalidations({})).toStrictEqual([])
    expect(parseInvalidations({ tags: 'all' })).toStrictEqual([])
  })
})
