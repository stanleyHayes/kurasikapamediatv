import { afterEach, describe, expect, it, vi } from 'vitest'
import { Actor, userId } from '@kurasikapa/domain'
import { resetEnv } from '../composition/env'
import { loadStaffProfileBySlug, loadStaffProfileByUser, loadStaffProfiles, saveAndPublishStaffProfile } from './staff-profiles'

const actor = new Actor(userId('admin'), ['administrator'])
const row = { id: 'profile', userId: 'journalist', locale: 'en', slug: 'ama', displayName: 'Ama', jobTitle: 'Reporter', biography: 'Biography', portrait: { url: 'https://cdn.test/ama.jpg', altText: 'Ama', width: 800, height: 1000 }, socialLinks: [{ Label: 'LinkedIn', URL: 'https://linkedin.test/ama' }] }
function configure(api = 'https://api.test'): void {
  vi.stubEnv('MONGODB_URI', 'mongodb://localhost/test'); vi.stubEnv('MONGODB_DB', 'test')
  vi.stubEnv('BETTER_AUTH_SECRET', 'a'.repeat(32)); vi.stubEnv('APP_URL', 'http://localhost:3000')
  vi.stubEnv('API_URL', api); resetEnv()
}

describe('staff profile BFF', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); resetEnv() })
  it('maps public directory and lookup responses', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ profiles: [row] }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify(row), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify(row), { status: 200 })))
    await expect(loadStaffProfiles('en')).resolves.toMatchObject([{ displayName: 'Ama', socialLinks: [{ label: 'LinkedIn' }] }])
    await expect(loadStaffProfileBySlug('en', 'ama')).resolves.toMatchObject({ slug: 'ama' })
    await expect(loadStaffProfileByUser('en', 'journalist')).resolves.toMatchObject({ userId: 'journalist' })
  })
  it('returns null for a missing profile and empty without an API', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ type: 'not_found', title: 'Not found' }), { status: 404 })))
    await expect(loadStaffProfileBySlug('en', 'missing')).resolves.toBeNull()
    configure(''); vi.stubEnv('API_URL', undefined); resetEnv()
    await expect(loadStaffProfiles('en')).resolves.toEqual([])
  })
  it('saves then publishes through the authenticated API seam', async () => {
    configure()
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: 'profile' }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ id: 'profile' }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(saveAndPublishStaffProfile(actor, 'journalist', {})).resolves.toEqual({ id: 'profile' })
    expect(fetcher).toHaveBeenNthCalledWith(2, 'https://api.test/staff/profiles/profile/publish', expect.objectContaining({ method: 'POST' }))
  })
  it('fails closed when management is unconfigured or either command fails', async () => {
    configure(''); vi.stubEnv('API_URL', undefined); resetEnv()
    await expect(saveAndPublishStaffProfile(actor, 'journalist', {})).rejects.toThrow(/API_URL/u)
    configure()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ type: 'invalid_input', title: 'Bad profile' }), { status: 400 })))
    await expect(saveAndPublishStaffProfile(actor, 'journalist', {})).rejects.toThrow('Bad profile')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: 'profile' }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ type: 'conflict', title: 'Bad portrait' }), { status: 409 })))
    await expect(saveAndPublishStaffProfile(actor, 'journalist', {})).rejects.toThrow('Bad portrait')
  })
  it('maps defensive defaults and propagates non-missing lookup failures', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ profiles: [null] }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ type: 'internal', title: 'Unavailable' }), { status: 500 })))
    await expect(loadStaffProfiles('en')).resolves.toMatchObject([{ displayName: '', portrait: { width: 0 } }])
    await expect(loadStaffProfileByUser('en', 'journalist')).rejects.toThrow('Unavailable')
  })
})
