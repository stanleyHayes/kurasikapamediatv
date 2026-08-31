import { afterEach, describe, expect, it, vi } from 'vitest'
import { Actor, userId } from '@kurasikapa/domain'
import { resetEnv } from '../composition/env'
import { attachArticleHero, completeMediaUpload, createMediaUpload, loadMediaAssets } from './media-library'

const actor = new Actor(userId('user_1'), ['video_editor'])
function configure(): void {
  vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/test'); vi.stubEnv('MONGODB_DB', 'test')
  vi.stubEnv('BETTER_AUTH_SECRET', 'a'.repeat(32)); vi.stubEnv('APP_URL', 'http://localhost:3000')
  vi.stubEnv('API_URL', 'http://api.test'); resetEnv()
}

describe('media library BFF', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); resetEnv() })

  it('loads and maps the verified asset inventory', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ items: [{ id: 'asset_1', kind: 'video', filename: 'report.mp4', mimeType: 'video/mp4', locale: 'en', status: 'ready', secureUrl: 'https://cdn.test/report.mp4', bytes: 4096 }] }), { status: 200 })))
    const items = await loadMediaAssets(actor, 'en')
    expect(items[0]).toMatchObject({ id: 'asset_1', filename: 'report.mp4', bytes: 4096 })
  })

  it('creates a signed ticket and completes the provider receipt', async () => {
    configure()
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ asset: { id: 'asset_1', kind: 'video', filename: 'report.mp4' }, upload: { url: 'https://provider.test/upload', apiKey: 'key', signature: 'sig', publicId: 'asset_1', resourceType: 'video', folder: 'kurasikapa/media', timestamp: 42 } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'asset_1', kind: 'video', filename: 'report.mp4', status: 'ready' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const created = await createMediaUpload(actor, { kind: 'video' })
    expect(created.upload).toMatchObject({ publicID: 'asset_1', timestamp: 42 })
    const completed = await completeMediaUpload(actor, 'asset_1', { signature: 'provider' })
    expect(completed.status).toBe('ready')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('fails when the production API seam is unavailable', async () => {
    vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/test'); vi.stubEnv('MONGODB_DB', 'test')
    vi.stubEnv('BETTER_AUTH_SECRET', 'a'.repeat(32)); vi.stubEnv('APP_URL', 'http://localhost:3000')
    vi.stubEnv('API_URL', undefined); resetEnv()
    await expect(loadMediaAssets(actor, 'en')).rejects.toThrow(/API_URL/u)
  })

  it('attaches a verified image with its public attribution', async () => {
    configure()
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      assetId: 'asset_1', secureUrl: 'https://cdn.test/market.jpg', altText: 'A market reporter',
      caption: 'Reporting from Makola.', credit: 'Kurasikapa / Ama Mensah', width: 1600, height: 900,
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const hero = await attachArticleHero(actor, 'article_1', { assetId: 'asset_1', credit: 'Newsroom' })

    expect(hero).toMatchObject({ assetId: 'asset_1', credit: 'Kurasikapa / Ama Mensah', width: 1600 })
    expect(fetchMock).toHaveBeenCalledWith('http://api.test/articles/article_1/hero', expect.objectContaining({ method: 'PUT' }))
  })

  it('surfaces API problems', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ type: 'not_permitted', title: 'Not permitted' }), { status: 403 })))
    await expect(loadMediaAssets(actor, 'en')).rejects.toThrow(/Not permitted/u)
  })

  it('returns an empty inventory when the API omits items', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 })))
    await expect(loadMediaAssets(actor, 'en')).resolves.toEqual([])
  })

  it('surfaces attribution errors while attaching an article image', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      type: 'invalid_article_hero', title: 'Image credit is required',
    }), { status: 422 })))
    await expect(attachArticleHero(actor, 'article_1', {
      assetId: 'asset_1', credit: '',
    })).rejects.toThrow(/Image credit is required/u)
  })
})
