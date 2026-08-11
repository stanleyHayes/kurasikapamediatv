import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createDraftViaApi } from './create-draft'

describe('createDraftViaApi', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const input = {
    baseUrl: 'http://localhost:8080',
    userId: 'usr_author',
    locale: 'en',
    title: 'Budget 2026',
    body: 'The minister…',
    categoryId: 'cat_business',
  }

  it('POSTs to /articles with the trusted user header', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'art_1',
          familyId: 'fam_1',
          locale: 'en',
          slug: 'budget-2026',
          title: 'Budget 2026',
          status: 'draft',
          publishedAt: null,
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const article = await createDraftViaApi(input)

    expect(article.slug).toBe('budget-2026')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('http://localhost:8080/articles')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({
      'Content-Type': 'application/json',
      'X-Kurasikapa-User': 'usr_author',
    })
    expect(init?.body).toBe(
      JSON.stringify({
        locale: 'en',
        title: 'Budget 2026',
        body: 'The minister…',
        categoryId: 'cat_business',
        familyId: '',
      }),
    )
  })

  it('forwards a family id when translating into an existing family', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'art_2',
          familyId: 'fam_1',
          locale: 'fr',
          slug: 'budget-2026',
          title: 'Budget',
          status: 'draft',
          publishedAt: null,
        }),
        { status: 201 },
      ),
    )

    await createDraftViaApi({ ...input, locale: 'fr', familyId: 'fam_1' })

    const body = fetchMock.mock.calls[0]?.[1]?.body
    expect(typeof body).toBe('string')
    expect(JSON.parse(body as string)).toMatchObject({ familyId: 'fam_1' })
  })

  it('throws an ApiProblem on a slug collision', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ type: 'slug_taken', title: 'taken', status: 409 }), {
        status: 409,
      }),
    )

    await expect(createDraftViaApi(input)).rejects.toMatchObject({
      name: 'ApiProblem',
      type: 'slug_taken',
    })
  })
})
