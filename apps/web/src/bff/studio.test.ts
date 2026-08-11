import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { studioArticleFrom, toDraftView, apiGet } from './studio'

describe('studioArticleFrom', () => {
  it('maps a Go listing row onto DraftView', () => {
    const dto = studioArticleFrom({
      id: 'art_1',
      familyId: 'fam_1',
      locale: 'en',
      slug: 'budget-2026',
      title: 'Budget 2026',
      status: 'draft',
      categoryId: 'cat_1',
      publishedAt: null,
      scheduledAt: null,
      excerpt: 'Opening.',
    })

    expect(studioArticleFrom('not-an-object').id).toBe('')
    expect(toDraftView(dto)).toMatchObject({
      id: 'art_1',
      title: 'Budget 2026',
      excerpt: 'Opening.',
      status: 'draft',
    })
  })
})

describe('apiGet', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('forwards the user header', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    )

    await apiGet({ baseUrl: 'http://api.test', userId: 'usr_1', path: '/me/articles' })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/me/articles',
      expect.objectContaining({
        headers: { 'X-Kurasikapa-User': 'usr_1' },
      }),
    )
  })
})
