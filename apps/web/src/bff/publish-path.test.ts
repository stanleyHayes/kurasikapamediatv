import { Actor, userId } from '@kurasikapa/domain'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../composition/announce-published', () => ({
  announcePublished: vi.fn().mockResolvedValue(undefined),
}))

import { publishArticle } from './publish-path'

const actor = new Actor(userId('usr_1'), [])

describe('publishArticle path', () => {
  it('uses TypeScript when API_URL is unset', async () => {
    const viaTypeScript = vi.fn().mockResolvedValue({ slug: 'budget-2026', locale: 'en' })
    const result = await publishArticle(actor, 'art_1', undefined, viaTypeScript)
    expect(result.slug).toBe('budget-2026')
    expect(viaTypeScript).toHaveBeenCalledOnce()
  })

  it('publishes via Go when API_URL is set', async () => {
    const viaTypeScript = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'art_1',
            slug: 'budget-2026',
            locale: 'en',
            title: 'Budget 2026',
            status: 'published',
            publishedAt: '2026-08-09T12:00:00Z',
          }),
          { status: 200 },
        ),
      ),
    )
    try {
      const result = await publishArticle(actor, 'art_1', 'http://api.test', viaTypeScript)
      expect(result).toEqual({ slug: 'budget-2026', locale: 'en' })
      expect(viaTypeScript).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
