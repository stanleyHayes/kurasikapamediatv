import { Actor, userId } from '@kurasikapa/domain'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../composition/announce-transition', () => ({
  announceTransition: vi.fn().mockResolvedValue(undefined),
}))

import { transitionArticle } from './transition-path'

const actor = new Actor(userId('usr_1'), [])
const article = {
  id: 'art_1',
  status: 'in_review',
  locale: 'en',
  slug: 'budget-2026',
}

describe('transitionArticle path', () => {
  it('uses TypeScript when API_URL is unset', async () => {
    const viaTypeScript = vi.fn().mockResolvedValue({ status: 'in_review' })
    const result = await transitionArticle(
      actor,
      { kind: 'submit', articleId: 'art_1' },
      undefined,
      viaTypeScript,
    )
    expect(result.status).toBe('in_review')
    expect(viaTypeScript).toHaveBeenCalledOnce()
  })

  it('posts each kind to Go when API_URL is set', async () => {
    const viaTypeScript = vi.fn()
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      () => Promise.resolve(new Response(JSON.stringify(article), { status: 200 })),
    )
    vi.stubGlobal('fetch', fetchMock)
    try {
      await transitionArticle(actor, { kind: 'submit', articleId: 'art_1' }, 'http://api.test', viaTypeScript)
      await transitionArticle(
        actor,
        { kind: 'approve', articleId: 'art_1', revisionId: 'rev_1' },
        'http://api.test',
        viaTypeScript,
      )
      await transitionArticle(
        actor,
        { kind: 'reject', articleId: 'art_1', note: 'Needs sources' },
        'http://api.test',
        viaTypeScript,
      )
      await transitionArticle(
        actor,
        { kind: 'schedule', articleId: 'art_1', at: new Date('2026-08-10T09:00:00Z') },
        'http://api.test',
        viaTypeScript,
      )
      await transitionArticle(
        actor,
        { kind: 'unpublish', articleId: 'art_1', reason: 'Correction' },
        'http://api.test',
        viaTypeScript,
      )
      expect(viaTypeScript).not.toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledTimes(5)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
