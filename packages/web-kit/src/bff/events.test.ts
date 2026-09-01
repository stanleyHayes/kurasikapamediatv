import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetEnv } from '../composition/env'
import { createAndPublishEvent, loadEvents } from './events'

describe('events BFF', () => {
  beforeEach(() => { vi.restoreAllMocks(); process.env['MONGODB_URI'] = 'mongodb://test'; process.env['BETTER_AUTH_SECRET'] = 'x'.repeat(32); process.env['API_URL'] = 'https://api.test'; resetEnv() })

  it('projects the public event library', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [{ id: 'event_1', type: 'summit', mode: 'hybrid', title: 'Media Futures', startsAt: '2026-09-10T09:00:00Z', endsAt: '2026-09-10T17:00:00Z', speakers: ['Ama Mensah'], featured: true, image: { url: 'https://cdn.test/event.jpg', altText: 'Delegates in Accra' } }] }), { status: 200 })))
    await expect(loadEvents('en')).resolves.toEqual([expect.objectContaining({ id: 'event_1', title: 'Media Futures', featured: true, image: { url: 'https://cdn.test/event.jpg', altText: 'Delegates in Accra' } })])
  })

  it('creates then explicitly publishes', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: 'event_1' }), { status: 201 })).mockResolvedValueOnce(new Response(JSON.stringify({ id: 'event_1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(createAndPublishEvent({ id: 'editor' } as never, { title: 'Media Futures' })).resolves.toEqual({ id: 'event_1' })
    expect(fetcher).toHaveBeenNthCalledWith(2, 'https://api.test/media/events/event_1/publish', expect.objectContaining({ method: 'POST' }))
  })

  it('fails honestly without the API seam', async () => {
    delete process.env['API_URL']; resetEnv()
    await expect(loadEvents('en')).resolves.toEqual([])
    await expect(createAndPublishEvent({ id: 'editor' } as never, {})).rejects.toThrow('API_URL is required')
  })
})
