import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetEnv } from '../composition/env'
import { createEvent, deleteEvent, loadEvent, loadEvents, loadStudioEvent, loadStudioEvents, publishEvent, unpublishEvent } from './events'

describe('events BFF', () => {
  beforeEach(() => { vi.restoreAllMocks(); process.env['MONGODB_URI'] = 'mongodb://test'; process.env['BETTER_AUTH_SECRET'] = 'x'.repeat(32); process.env['API_URL'] = 'https://api.test'; resetEnv() })

  it('projects the public event library', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [{ id: 'event_1', type: 'summit', mode: 'hybrid', title: 'Media Futures', startsAt: '2026-09-10T09:00:00Z', endsAt: '2026-09-10T17:00:00Z', speakers: ['Ama Mensah'], featured: true, image: { url: 'https://cdn.test/event.jpg', altText: 'Delegates in Accra' } }] }), { status: 200 })))
    await expect(loadEvents('en')).resolves.toEqual([expect.objectContaining({ id: 'event_1', title: 'Media Futures', featured: true, image: { url: 'https://cdn.test/event.jpg', altText: 'Delegates in Accra' } })])
  })

  /*
   * The point of the split. Creating used to publish in the same breath, which
   * is why an editor could never review an event before readers saw it. One
   * call, one request, and the listing stays a draft.
   */
  it('creates a draft and does NOT publish it', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'event_1' }), { status: 201 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(createEvent({ id: 'editor' } as never, { title: 'Media Futures' })).resolves.toEqual({ id: 'event_1' })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith('https://api.test/media/events', expect.objectContaining({ method: 'POST' }))
  })

  it('publishes and unpublishes as separate decisions', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    await publishEvent({ id: 'editor' } as never, 'event_1')
    expect(fetcher).toHaveBeenLastCalledWith('https://api.test/media/events/event_1/publish', expect.objectContaining({ method: 'POST' }))
    await unpublishEvent({ id: 'editor' } as never, 'event_1')
    expect(fetcher).toHaveBeenLastCalledWith('https://api.test/media/events/event_1/unpublish', expect.objectContaining({ method: 'POST' }))
  })

  it('reads drafts for the studio, and reports whether each is published', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [
      { id: 'draft_1', type: 'cultural', published: false, title: 'Kente Cultural Dinner' },
      { id: 'live_1', type: 'summit', published: true, title: 'Media Futures' },
    ] }), { status: 200 })))
    const items = await loadStudioEvents({ id: 'editor' } as never, 'fr')
    expect(items.map((item) => [item.id, item.type, item.published])).toEqual([
      ['draft_1', 'cultural', false], ['live_1', 'summit', true],
    ])
  })

  it('falls back to `other` for a type it does not know, rather than mislabelling it', async () => {
    // Guards the Go and TS type lists drifting apart. The old mapper returned
    // 'summit' for anything unrecognised, so a new Go type would have shown up
    // in the studio as a summit — a wrong label rather than a visible gap.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [
      { id: 'e1', type: 'cultural' }, { id: 'e2', type: 'hackathon' }, { id: 'e3', type: '' },
    ] }), { status: 200 })))
    const items = await loadEvents('en')
    expect(items.map((item) => item.type)).toEqual(['cultural', 'other', 'other'])
  })

  /*
   * Regression. The studio edit form seeds its image picker from this field;
   * when it was absent the picker started empty, no imageAssetID went in the
   * PATCH, and Update — which replaces the whole state — silently deleted the
   * event's picture on every save.
   */
  it('projects imageAssetId so an edit form can preselect the current image', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [
      { id: 'e1', imageAssetId: 'asset_9', image: { url: 'https://cdn.test/a.jpg', altText: 'Delegates' } },
      { id: 'e2' },
    ] }), { status: 200 })))
    const items = await loadEvents('en')
    expect(items[0]?.imageAssetId).toBe('asset_9')
    expect(items[1]?.imageAssetId).toBe('')
  })

  it('deletes a listing', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetcher)
    await deleteEvent({ id: 'editor' } as never, 'event_1')
    expect(fetcher).toHaveBeenCalledWith('https://api.test/media/events/event_1', expect.objectContaining({ method: 'DELETE' }))
  })

  it('surfaces a refusal to delete a published event rather than swallowing it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ title: 'unpublish an event before deleting it' }), { status: 409 })))
    await expect(deleteEvent({ id: 'editor' } as never, 'event_1')).rejects.toThrow()
  })

  describe('loadStudioEvent — one event for the edit screen', () => {
    it('returns the event, drafts included', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(
        { id: 'e1', type: 'cultural', published: false, title: 'Kente', imageAssetId: 'a1' }), { status: 200 })))
      const found = await loadStudioEvent({ id: 'editor' } as never, 'e1')
      expect(found?.title).toBe('Kente')
      expect(found?.published).toBe(false)
      expect(found?.imageAssetId).toBe('a1')
    })

    it('returns null on 404 so the page can call notFound()', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })))
      await expect(loadStudioEvent({ id: 'editor' } as never, 'missing')).resolves.toBeNull()
    })

    it('throws on any other failure rather than pretending the event is missing', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })))
      await expect(loadStudioEvent({ id: 'editor' } as never, 'e1')).rejects.toThrow()
    })
  })

  describe('loadEvent — the public detail page', () => {
    it('returns the published event', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'e1', title: 'Kente' }), { status: 200 })))
      await expect(loadEvent('fr', 'kente')).resolves.toMatchObject({ id: 'e1', title: 'Kente' })
    })

    it('returns null for a draft or a miss, so the page 404s rather than erroring', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('404')))
      await expect(loadEvent('fr', 'draft-slug')).resolves.toBeNull()
    })

    it('returns null when the payload is not an event', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
      await expect(loadEvent('fr', 'weird')).resolves.toBeNull()
    })
  })

  it('fails honestly without the API seam', async () => {
    delete process.env['API_URL']; resetEnv()
    await expect(loadEvents('en')).resolves.toEqual([])
    await expect(createEvent({ id: 'editor' } as never, {})).rejects.toThrow('API_URL is required')
    await expect(loadStudioEvents({ id: 'editor' } as never, 'en')).resolves.toEqual([])
    await expect(loadStudioEvent({ id: 'editor' } as never, 'e1')).resolves.toBeNull()
    await expect(loadEvent('en', 'kente')).resolves.toBeNull()
  })
})
