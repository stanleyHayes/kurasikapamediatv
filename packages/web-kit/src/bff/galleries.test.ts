import { afterEach, describe, expect, it, vi } from 'vitest'
import { Actor, userId } from '@kurasikapa/domain'
import { resetEnv } from '../composition/env'
import { createAndPublishGallery, loadGalleries } from './galleries'

const actor = new Actor(userId('manager'), ['video_editor'])
function configure(api = 'https://api.example.test'): void {
  vi.stubEnv('MONGODB_URI', 'mongodb://localhost/test'); vi.stubEnv('MONGODB_DB', 'test')
  vi.stubEnv('BETTER_AUTH_SECRET', 'a'.repeat(32)); vi.stubEnv('APP_URL', 'http://localhost:3000')
  vi.stubEnv('API_URL', api); resetEnv()
}

describe('gallery BFF', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); resetEnv() })

  it('maps the public gallery library', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ items: [{ id: 'gallery', kind: 'video', title: 'Accra dispatch', media: [{ assetId: 'video', url: 'https://cdn.test/video.mp4', captionUrl: 'https://cdn.test/video.vtt', caption: 'At the market' }] }] }), { status: 200 })))
    const galleries = await loadGalleries('en')
    expect(galleries[0]).toMatchObject({ id: 'gallery', kind: 'video', title: 'Accra dispatch' })
    expect(galleries[0]?.media[0]?.captionUrl).toContain('.vtt')
  })

  it('creates then explicitly publishes a gallery', async () => {
    configure()
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'gallery' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'gallery' }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(createAndPublishGallery(actor, { kind: 'photo' })).resolves.toEqual({ id: 'gallery' })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher).toHaveBeenNthCalledWith(2, 'https://api.example.test/media/galleries/gallery/publish', expect.objectContaining({ method: 'POST' }))
  })

  it('returns an empty library without the production API', async () => {
    configure(''); vi.stubEnv('API_URL', undefined); resetEnv()
    await expect(loadGalleries('en')).resolves.toEqual([])
  })
})
