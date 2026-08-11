import { describe, expect, it, vi, afterEach } from 'vitest'
import { loadPublishedArticle, loadPublishedList, loadSectionPage, loadSections } from './load-public'

describe('load public path', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses TypeScript when API_URL is unset', async () => {
    const viaTypeScript = vi.fn().mockResolvedValue(null)
    await loadPublishedArticle('budget-2026', 'en', undefined, viaTypeScript)
    await loadPublishedList({ locale: 'en', limit: 12 }, undefined, vi.fn().mockResolvedValue({ items: [], nextCursor: null }))
    await loadSectionPage('business', 'en', undefined, vi.fn().mockResolvedValue(null))
    await loadSections('en', undefined, vi.fn().mockResolvedValue([]))
    expect(viaTypeScript).toHaveBeenCalledOnce()
  })

  it('loads a published article from Go', async () => {
    const viaTypeScript = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            article: {
              id: 'art_1',
              slug: 'budget-2026',
              locale: 'en',
              title: 'Budget 2026',
              categoryId: 'cat_business',
              publishedAt: '2026-08-09T12:00:00Z',
            },
            body: 'Approved text.',
          }),
          { status: 200 },
        ),
      ),
    )

    const found = await loadPublishedArticle(
      'budget-2026',
      'en',
      'http://api.test',
      viaTypeScript,
    )

    expect(viaTypeScript).not.toHaveBeenCalled()
    expect(found).toMatchObject({ id: 'art_1', body: 'Approved text.' })
  })

  it('rethrows a non-404 API problem', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ type: 'internal', title: 'boom' }), { status: 500 }),
      ),
    )

    await expect(loadPublishedArticle('budget-2026', 'en', 'http://api.test', vi.fn())).rejects.toThrow(
      /boom/u,
    )
  })

  it('maps a public 404 to null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ type: 'not_found', title: 'Not found' }), { status: 404 }),
      ),
    )

    const found = await loadPublishedArticle('nope', 'en', 'http://api.test', vi.fn())
    expect(found).toBeNull()
  })

  it('lists published articles from Go', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [
              {
                id: 'art_1',
                slug: 'budget-2026',
                locale: 'en',
                title: 'Budget 2026',
                categoryId: 'cat_business',
                publishedAt: null,
              },
            ],
            nextCursor: '',
          }),
          { status: 200 },
        ),
      ),
    )

    const page = await loadPublishedList(
      { locale: 'en', limit: 12, after: 'art_9' },
      'http://api.test',
      vi.fn(),
    )
    expect(page.items).toHaveLength(1)
    expect(page.nextCursor).toBeNull()
  })

  it('loads sections and a section page from Go', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [{ slug: 'business' }] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            category: { id: 'cat_business', slug: 'business', name: 'Business', description: null, order: 1 },
            articles: {
              items: [
                {
                  article: {
                    id: 'art_1',
                    slug: 'budget-2026',
                    locale: 'en',
                    title: 'Budget 2026',
                    categoryId: 'cat_business',
                    publishedAt: null,
                  },
                  excerpt: 'Opening.',
                },
              ],
              nextCursor: '',
            },
          }),
          { status: 200 },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const nav = await loadSections('en', 'http://api.test', vi.fn())
    expect(nav).toEqual([{ slug: 'business' }])

    const section = await loadSectionPage('business', 'en', 'http://api.test', vi.fn())
    expect(section?.name).toBe('Business')
    expect(section?.articles[0]?.excerpt).toBe('Opening.')
  })
})
