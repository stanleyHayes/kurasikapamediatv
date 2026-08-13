import { Actor, userId } from '@kurasikapa/domain'
import { NotPermitted } from '@kurasikapa/domain'
import { afterEach, describe, expect, it, vi } from 'vitest'

const apiUrl = vi.hoisted(() => ({ current: undefined as string | undefined }))

vi.mock('../composition/env', () => ({
  env: () => ({ API_URL: apiUrl.current }),
}))

import { loadAuthoredPipeline, loadReviewQueue, loadStudioDraft, revisionToView } from './load-studio'

const actor = new Actor(userId('usr_author'), [])

const article = {
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
}

describe('load studio', () => {
  afterEach(() => {
    apiUrl.current = undefined
    vi.unstubAllGlobals()
  })

  it('uses TypeScript for the pipeline when API_URL is unset', async () => {
    const viaTypeScript = vi.fn().mockResolvedValue([])
    await loadAuthoredPipeline(actor, viaTypeScript)
    await loadReviewQueue(actor, viaTypeScript)
    expect(viaTypeScript).toHaveBeenCalledTimes(2)
  })

  it('loads a draft and the pipeline from Go', async () => {
    apiUrl.current = 'http://api.test'
    const fetchMock = vi.fn<typeof fetch>()
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ article, latest: { body: 'Hello', id: 'rev_1', seq: 1, title: 'Budget 2026', createdAt: '2026-08-09T12:00:00Z', excerpt: 'Hello' } }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [article] }), { status: 200 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const draft = await loadStudioDraft(actor, 'art_1')
    expect(draft.body).toBe('Hello')
    expect(draft.title).toBe('Budget 2026')

    const pipeline = await loadAuthoredPipeline(actor, vi.fn())
    expect(pipeline[0]?.id).toBe('art_1')
  })

  it('treats a null latest revision as an empty body', async () => {
    apiUrl.current = 'http://api.test'
    const fetchMock = vi.fn<typeof fetch>()
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ article, latest: null }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const draft = await loadStudioDraft(actor, 'art_1')
    expect(draft.body).toBe('')
    expect(draft.revisions).toEqual([])
  })

  it('maps a review 403 onto NotPermitted', async () => {
    apiUrl.current = 'http://api.test'
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ type: 'not_permitted', title: 'Not permitted' }), {
          status: 403,
        }),
      ),
    )

    await expect(loadReviewQueue(actor, vi.fn())).rejects.toBeInstanceOf(NotPermitted)
  })

  it('maps a draft 404 onto ArticleNotFound', async () => {
    apiUrl.current = 'http://api.test'
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ type: 'not_found', title: 'Not found' }), { status: 404 }),
      ),
    )

    await expect(loadStudioDraft(actor, 'missing')).rejects.toThrow(/missing/u)
  })

  it('rethrows a non-404 draft error', async () => {
    apiUrl.current = 'http://api.test'
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ type: 'internal', title: 'boom' }), { status: 500 }),
      ),
    )
    await expect(loadStudioDraft(actor, 'art_1')).rejects.toThrow(/boom/u)
  })

  it('rethrows a non-403 review error', async () => {
    apiUrl.current = 'http://api.test'
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ type: 'internal', title: 'boom' }), { status: 500 }),
      ),
    )
    await expect(loadReviewQueue(actor, vi.fn())).rejects.toThrow(/boom/u)
  })

  it('maps a revision onto the history panel', () => {
    const view = revisionToView({
      id: 'rev_1',
      seq: 1,
      title: 'Budget',
      body: 'Opening paragraph.',
      createdAt: new Date('2026-08-09T12:00:00Z'),
    })
    expect(view.seq).toBe(1)
    expect(view.excerpt).toContain('Opening')
  })
})
