import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { updateDraftViaApi } from './update-draft'
import { transitionViaApi } from './transition'

describe('updateDraftViaApi', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('PATCHes the article and returns seq + slug', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ revisionId: 'rev_2', seq: 2, slug: 'budget-revised' }), {
        status: 200,
      }),
    )

    const got = await updateDraftViaApi({
      baseUrl: 'http://api.test',
      userId: 'usr_1',
      articleId: 'art_1',
      title: 'Budget Revised',
      body: 'Text',
    })

    expect(got).toEqual({ revisionId: 'rev_2', seq: 2, slug: 'budget-revised' })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/articles/art_1',
      expect.objectContaining({ method: 'PATCH' }),
    )
  })
})

describe('transitionViaApi', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs submit without a body', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'art_1',
          status: 'in_review',
          locale: 'en',
          slug: 'budget',
        }),
        { status: 200 },
      ),
    )

    const got = await transitionViaApi({
      baseUrl: 'http://api.test',
      userId: 'usr_1',
      kind: 'submit',
      articleId: 'art_1',
    })

    expect(got.status).toBe('in_review')
    const submitInit = fetchMock.mock.calls[0]![1]!
    expect(submitInit.body).toBeUndefined()
  })

  it('POSTs approve with revisionId', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'art_1',
          status: 'approved',
          locale: 'en',
          slug: 'budget',
        }),
        { status: 200 },
      ),
    )

    await transitionViaApi({
      baseUrl: 'http://api.test',
      userId: 'usr_1',
      kind: 'approve',
      articleId: 'art_1',
      revisionId: 'rev_1',
    })

    const approveInit = fetchMock.mock.calls[0]![1]!
    expect(approveInit.body).toBe(JSON.stringify({ revisionId: 'rev_1' }))
  })
})
