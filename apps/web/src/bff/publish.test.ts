import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { readArticleView } from './article-view'
import { publishViaApi } from './publish'

describe('publishViaApi', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs to /articles/{id}/publish with the user header', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'art_1',
          familyId: 'fam_1',
          locale: 'en',
          slug: 'budget-2026',
          title: 'Budget',
          status: 'published',
          publishedAt: '2026-08-10T12:00:00Z',
        }),
        { status: 200 },
      ),
    )

    const article = await publishViaApi({
      baseUrl: 'http://localhost:8080',
      userId: 'usr_editor',
      articleId: 'art_1',
    })

    expect(article).toEqual({ id: 'art_1', slug: 'budget-2026', locale: 'en' })
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('http://localhost:8080/articles/art_1/publish')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({ 'X-Kurasikapa-User': 'usr_editor' })
  })

  it('throws on a domain refusal', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ type: 'conflict', title: 'not approved', status: 409 }), {
        status: 409,
      }),
    )

    await expect(
      publishViaApi({
        baseUrl: 'http://localhost:8080',
        userId: 'usr_editor',
        articleId: 'art_1',
      }),
    ).rejects.toMatchObject({ type: 'conflict' })
  })
})

describe('readArticleView', () => {
  it('rejects a body without id or slug', async () => {
    await expect(readArticleView(new Response(JSON.stringify({ slug: 'x' })))).rejects.toThrow(
      /id or slug/u,
    )
  })

  it('rejects a body without locale', async () => {
    await expect(
      readArticleView(new Response(JSON.stringify({ id: 'art_1', slug: 'x' }))),
    ).rejects.toThrow(/locale/u)
  })
})
