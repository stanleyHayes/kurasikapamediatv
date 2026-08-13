import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { publishDueViaApi } from './publish-due'

describe('publishDueViaApi', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('forwards the cron Bearer secret and reads published items', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          published: [{ id: 'art_1', slug: 'budget', locale: 'en' }],
          failed: [],
        }),
        { status: 200 },
      ),
    )

    const result = await publishDueViaApi({
      baseUrl: 'http://localhost:8080/',
      cronSecret: 's'.repeat(32),
    })

    expect(result.published).toEqual([{ id: 'art_1', slug: 'budget', locale: 'en' }])
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('http://localhost:8080/internal/publish-due')
    expect(init?.headers).toEqual({ Authorization: `Bearer ${'s'.repeat(32)}` })
  })

  it('accepts 207 when some articles failed', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          published: [],
          failed: [{ articleId: 'art_bad', reason: 'no approval' }],
        }),
        { status: 207 },
      ),
    )

    const result = await publishDueViaApi({
      baseUrl: 'http://localhost:8080',
      cronSecret: 's'.repeat(32),
    })

    expect(result.failed).toEqual([{ articleId: 'art_bad', reason: 'no approval' }])
  })
})
