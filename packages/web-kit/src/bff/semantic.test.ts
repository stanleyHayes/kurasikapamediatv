import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadSemanticRelated, loadSemanticSearch, processSemanticIndex } from './semantic'

afterEach(() => vi.unstubAllGlobals())

const response = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

describe('semantic discovery BFF', () => {
  it('maps semantic search cards', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ items: [{
      article: { id: 'art_1', authorId: 'usr_1', slug: 'budget', locale: 'en', title: 'Budget', categoryId: 'business', publishedAt: null, hero: null, narration: null },
      excerpt: 'The fiscal plan', readingMinutes: 3,
    }] })))
    const items = await loadSemanticSearch('https://api.example', 'en', 'fiscal plan', 10)
    expect(items).toMatchObject([{ id: 'art_1', excerpt: 'The fiscal plan', readingMinutes: 3 }])
    expect(fetch).toHaveBeenCalledWith('https://api.example/public/en/search?q=fiscal+plan&limit=10')
  })

  it('requests related stories by source id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ items: [] })))
    await expect(loadSemanticRelated('https://api.example', 'en', 'art_1', 4)).resolves.toEqual([])
    expect(fetch).toHaveBeenCalledWith('https://api.example/public/en/articles/art_1/related?limit=4')
  })

  it('forwards the protected indexing job', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ process: { indexed: 2 } })))
    await processSemanticIndex({ baseUrl: 'https://api.example', cronSecret: 'cron' })
    expect(fetch).toHaveBeenCalledWith('https://api.example/internal/process-semantic-index', {
      method: 'POST', headers: { Authorization: 'Bearer cron' },
    })
  })
})
