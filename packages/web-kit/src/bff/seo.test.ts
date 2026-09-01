import { afterEach, describe, expect, it, vi } from 'vitest'
import { Actor, userId } from '@kurasikapa/domain'
import { resetEnv } from '../composition/env'
import { loadSEOReport } from './seo'

function configure(): void {
  vi.stubEnv('MONGODB_URI', 'mongodb://localhost/test')
  vi.stubEnv('BETTER_AUTH_SECRET', 'a'.repeat(32))
  vi.stubEnv('APP_URL', 'http://localhost:3000')
  vi.stubEnv('API_URL', 'https://api.test')
  resetEnv()
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); resetEnv() })

describe('SEO report BFF', () => {
  it('loads and normalises the authenticated readiness report', async () => {
    configure()
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      generatedAt: '2026-09-01T08:00:00Z', totalPublished: 4, readyArticles: 2,
      warningArticles: 1, criticalArticles: 1, readinessPercent: 50,
      locales: [{ locale: 'en', published: 4, ready: 2, warning: 1, critical: 1, readinessPercent: 50 }],
      issues: [{ articleId: 'story', locale: 'en', slug: 'story', title: 'Story', severity: 'critical', code: 'missing_hero', message: 'Missing image', recommendation: 'Attach one' }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)

    const report = await loadSEOReport(new Actor(userId('editor'), ['editor']))

    expect(report).toMatchObject({ totalPublished: 4, readinessPercent: 50, locales: [{ ready: 2 }], issues: [{ code: 'missing_hero' }] })
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({ 'X-Kurasikapa-User': 'editor' })
  })

  it('fails closed without the API and surfaces permission failures', async () => {
    configure()
    vi.stubEnv('API_URL', undefined)
    resetEnv()
    const actor = new Actor(userId('author'), ['author'])
    await expect(loadSEOReport(actor)).rejects.toThrow(/API_URL/u)

    configure()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ type: 'not_permitted', title: 'Not permitted' }), { status: 403 })))
    await expect(loadSEOReport(actor)).rejects.toThrow('Not permitted')
  })

  it('normalises malformed optional collections instead of crashing Studio', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ totalPublished: 'bad', locales: null, issues: [{ severity: 'unexpected' }] }), { status: 200 })))
    await expect(loadSEOReport(new Actor(userId('admin'), ['administrator']))).resolves.toMatchObject({ totalPublished: 0, locales: [], issues: [{ severity: 'warning' }] })
  })
})
