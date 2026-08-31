import { afterEach, describe, expect, it, vi } from 'vitest'
import { Actor, userId } from '@kurasikapa/domain'
import { resetEnv } from '../composition/env'
import { createAndPublishEpisode, createAndPublishPodcast, loadPodcasts } from './podcasts'

const actor = new Actor(userId('editor_1'), ['video_editor'])
function configure(api = 'http://api.test'): void {
  vi.stubEnv('MONGODB_URI', 'mongodb://localhost/test'); vi.stubEnv('MONGODB_DB', 'test')
  vi.stubEnv('BETTER_AUTH_SECRET', 'a'.repeat(32)); vi.stubEnv('APP_URL', 'http://localhost:3000')
  vi.stubEnv('API_URL', api); resetEnv()
}

describe('podcast BFF', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); resetEnv() })
  it('maps the public podcast library including chapters and delivery metadata', async () => {
    configure(); vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ items: [{ id: 'pod_1', title: 'The Brief', episodes: [{ id: 'ep_1', title: 'Markets', audioUrl: 'https://cdn.test/audio.mp3', transcriptUrl: 'https://cdn.test/transcript.txt', audioBytes: 1200, audioMimeType: 'audio/mpeg', chapters: [{ Title: 'Opening', StartsAtSec: 0 }] }] }] }), { status: 200 })))
    const result = await loadPodcasts('en')
    expect(result[0]?.episodes[0]).toMatchObject({ title: 'Markets', audioBytes: 1200, chapters: [{ title: 'Opening', startsAtSec: 0 }] })
  })
  it('creates and explicitly publishes series and episodes', async () => {
    configure(); const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'pod_1' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'pod_1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ep_1' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ep_1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(createAndPublishPodcast(actor, { title: 'The Brief' })).resolves.toEqual({ id: 'pod_1' })
    await expect(createAndPublishEpisode(actor, { title: 'Markets' })).resolves.toEqual({ id: 'ep_1' })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
  it('returns an empty fallback without an API and surfaces API problems', async () => {
    configure(''); vi.stubEnv('API_URL', undefined); resetEnv()
    await expect(loadPodcasts('en')).resolves.toEqual([])
    await expect(createAndPublishPodcast(actor, {})).rejects.toThrow(/API_URL/u)
    configure(); vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ type: 'conflict', title: 'Audio is not ready' }), { status: 409 })))
    await expect(createAndPublishEpisode(actor, {})).rejects.toThrow(/Audio is not ready/u)
  })
})
