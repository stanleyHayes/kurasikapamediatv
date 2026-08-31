import { afterEach, describe, expect, it, vi } from 'vitest'
import { Actor, userId } from '@kurasikapa/domain'
import { resetEnv } from '../composition/env'
import { createAndPublishPresenter, createAndPublishProgramme, createSchedule, loadTelevisionGuide } from './television'

const required = {
  MONGODB_URI: 'mongodb://localhost:27017', MONGODB_DB: 'test',
  BETTER_AUTH_SECRET: 'a'.repeat(32), APP_URL: 'http://localhost:3000',
}
function setEnv(apiUrl?: string): void {
  for (const [key, value] of Object.entries(required)) vi.stubEnv(key, value)
  vi.stubEnv('API_URL', apiUrl)
  resetEnv()
}
const actor = new Actor(userId('user_1'), ['video_editor'])

describe('television BFF', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); resetEnv() })

  it('uses the TypeScript fallbacks when API_URL is unset', async () => {
    setEnv()
    const guideFallback = vi.fn().mockResolvedValue({ presenters: [], programmes: [], upcoming: [], replays: [] })
    const commandFallback = vi.fn().mockResolvedValue({ id: 'local' })
    await expect(loadTelevisionGuide('en', guideFallback)).resolves.toMatchObject({ presenters: [] })
    await expect(createAndPublishPresenter(actor, {}, commandFallback)).resolves.toEqual({ id: 'local' })
    await expect(createAndPublishProgramme(actor, {}, commandFallback)).resolves.toEqual({ id: 'local' })
    await expect(createSchedule(actor, {}, commandFallback)).resolves.toEqual({ id: 'local' })
    expect(guideFallback).toHaveBeenCalledOnce()
    expect(commandFallback).toHaveBeenCalledTimes(3)
  })

  it('maps the public guide from Go', async () => {
    setEnv('http://api.test')
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      presenters: [{ id: 'p1', name: 'Ama', slug: 'ama', locale: 'en', role: 'Host', biography: 'Bio', published: true }],
      programmes: [{ programme: { id: 'g1', title: 'Morning', slug: 'morning', locale: 'en', summary: 'Summary', category: 'News', presenterIds: ['p1'], published: true }, presenters: [{ id: 'p1', name: 'Ama' }] }],
      upcoming: [{ slot: { id: 's1', programmeId: 'g1', locale: 'en', startsAt: '2026-09-01T08:00:00Z', endsAt: '2026-09-01T09:00:00Z', isLive: true, state: 'scheduled' }, programme: { id: 'g1', title: 'Morning' } }],
      replays: [],
    }), { status: 200 })))
    const guide = await loadTelevisionGuide('en', vi.fn())
    expect(guide.presenters[0]?.name).toBe('Ama')
    expect(guide.programmes[0]?.presenters[0]?.id).toBe('p1')
    expect(guide.upcoming[0]?.slot.isLive).toBe(true)
  })

  it('creates, publishes and schedules through authenticated Go commands', async () => {
    setEnv('http://api.test')
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'p1' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'p1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'g1' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'g1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 's1' }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(createAndPublishPresenter(actor, { name: 'Ama' }, vi.fn())).resolves.toEqual({ id: 'p1' })
    await expect(createAndPublishProgramme(actor, { title: 'Morning' }, vi.fn())).resolves.toEqual({ id: 'g1' })
    await expect(createSchedule(actor, { programmeId: 'g1' }, vi.fn())).resolves.toEqual({ id: 's1' })
    expect(fetchMock).toHaveBeenCalledTimes(5)
    const options = fetchMock.mock.calls[0]?.[1]
    expect(options?.method).toBe('POST')
    expect((options?.headers as Record<string, string>)['X-Kurasikapa-User']).toBe('user_1')
  })

  it('surfaces an API problem', async () => {
    setEnv('http://api.test')
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ type: 'internal', title: 'down' }), { status: 500 })))
    await expect(createSchedule(actor, {}, vi.fn())).rejects.toThrow(/down/u)
  })
})
