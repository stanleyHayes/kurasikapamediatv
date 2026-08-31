import { Actor, userId } from '@kurasikapa/domain'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetEnv } from '../composition/env'
import {
  attachGeneratedNarration,
  loadLatestArticleNarration,
  processNarrationsViaApi,
  processRecordingsViaApi,
  requestArticleNarration,
} from './article-narration'

const actor = new Actor(userId('editor_1'), ['editor'])

function configure(api = 'https://api.test'): void {
  vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017')
  vi.stubEnv('MONGODB_DB', 'test')
  vi.stubEnv('BETTER_AUTH_SECRET', 'a'.repeat(32))
  vi.stubEnv('APP_URL', 'https://web.test')
  vi.stubEnv('API_URL', api)
  resetEnv()
}

describe('article narration BFF', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); resetEnv() })

  it('requests and maps a private job', async () => {
    configure()
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      id: 'nar_1', articleId: 'art_1', revisionId: 'rev_1', assetId: null,
      locale: 'en', voice: 'Amy', status: 'processing', failureReason: '',
      secureUrl: null, durationSeconds: null,
    })))
    vi.stubGlobal('fetch', fetchMock)

    await expect(requestArticleNarration(actor, 'art 1')).resolves.toMatchObject({ id: 'nar_1', status: 'processing' })
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.test/articles/art%201/narrations')
  })

  it('maps ready preview fields and attached audio', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'nar_1', status: 'ready', secureUrl: 'https://cdn.test/a.mp3', durationSeconds: 42 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ assetId: 'asset_1', sourceRevisionId: 'rev_1', secureUrl: 'https://cdn.test/a.mp3', durationSeconds: 42, voice: 'Amy' }))))

    await expect(loadLatestArticleNarration(actor, 'art_1')).resolves.toMatchObject({ secureUrl: 'https://cdn.test/a.mp3', durationSeconds: 42 })
    await expect(attachGeneratedNarration(actor, 'art_1', 'nar_1')).resolves.toMatchObject({ mimeType: 'audio/mpeg', voice: 'Amy' })
  })

  it('returns null for a missing latest job', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ type: 'not_found', title: 'missing' }), { status: 404 })))
    await expect(loadLatestArticleNarration(actor, 'art_1')).resolves.toBeNull()
  })

  it('preserves non-not-found latest-job failures', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ type: 'internal', title: 'down' }), { status: 500 })))
    await expect(loadLatestArticleNarration(actor, 'art_1')).rejects.toThrow(/down/u)
  })

  it('normalises empty optional preview values', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      id: 'nar_2', status: 'requested', assetId: '', secureUrl: '', durationSeconds: 0,
    }))))
    await expect(loadLatestArticleNarration(actor, 'art_1')).resolves.toMatchObject({ assetId: null, secureUrl: null, durationSeconds: null })
  })

  it('defensively maps malformed provider responses', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify('unexpected')))
      .mockResolvedValueOnce(new Response(JSON.stringify({ durationSeconds: 'unknown' }))))
    await expect(requestArticleNarration(actor, 'art_1')).resolves.toMatchObject({ id: '', assetId: null })
    await expect(attachGeneratedNarration(actor, 'art_1', 'nar_1')).resolves.toMatchObject({ durationSeconds: 0, voice: '' })
  })

  it('fails closed without API configuration', async () => {
    configure('')
    vi.stubEnv('API_URL', undefined)
    resetEnv()
    await expect(requestArticleNarration(actor, 'art_1')).rejects.toThrow(/API_URL/u)
  })

  it('processes 207 responses and rejects other failures', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ready: [], failed: ['nar_1'] }), { status: 207 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ type: 'internal', title: 'down' }), { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(processNarrationsViaApi({ baseUrl: 'https://api.test/', cronSecret: 'secret' })).resolves.toMatchObject({ failed: ['nar_1'] })
    await expect(processNarrationsViaApi({ baseUrl: 'https://api.test', cronSecret: 'secret' })).rejects.toThrow(/down/u)
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({ Authorization: 'Bearer secret' })
  })

  it('processes recording jobs through the authenticated API cron', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ processing: 1, ready: 0, failed: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ type: 'internal', title: 'down' }), { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(processRecordingsViaApi({ baseUrl: 'https://api.test/', cronSecret: 'secret' })).resolves.toMatchObject({ processing: 1 })
    await expect(processRecordingsViaApi({ baseUrl: 'https://api.test', cronSecret: 'secret' })).rejects.toThrow(/down/u)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.test/internal/process-recordings')
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({ Authorization: 'Bearer secret' })
  })
})
