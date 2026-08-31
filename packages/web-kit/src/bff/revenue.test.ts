import { afterEach, describe, expect, it, vi } from 'vitest'
import { Actor, userId } from '@kurasikapa/domain'
import { createAndActivateAdCampaign, createAndActivateMembershipPlan, loadAdPlacement, loadAdReport, loadMembershipPlans, loadRevenueReport, recordAdEvent, startDonationCheckout, startMembershipCheckout } from './revenue'
import { resetEnv } from '../composition/env'

function configure(): void {
  vi.stubEnv('MONGODB_URI', 'mongodb://localhost/test'); vi.stubEnv('MONGODB_DB', 'test')
  vi.stubEnv('BETTER_AUTH_SECRET', 'a'.repeat(32)); vi.stubEnv('APP_URL', 'http://localhost:3000')
  vi.stubEnv('API_URL', 'https://api.test'); resetEnv()
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); resetEnv() })

describe('revenue BFF', () => {
  it('loads active plans from the public Go seam', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ items: [{ id: 'supporter', name: 'Supporter', interval: 'monthly', price: { minor: 3500, currency: 'GHS' }, benefits: ['Briefings'] }] }), { status: 200 }))))
    const plans = await loadMembershipPlans('en')
    expect(plans[0]).toMatchObject({ id: 'supporter', price: { minor: 3500, currency: 'GHS' } })
  })

  it('keeps a safe empty fallback without the Go seam and maps yearly euro plans', async () => {
    configure(); vi.stubEnv('API_URL', undefined); resetEnv()
    await expect(loadMembershipPlans('en')).resolves.toEqual([])
    configure()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ items: [{ id: 'patron', interval: 'yearly', price: { minor: 1200, currency: 'EUR' }, benefits: ['Reports', 4] }] }), { status: 200 })))
    await expect(loadMembershipPlans('fr')).resolves.toEqual([expect.objectContaining({ interval: 'yearly', price: { minor: 1200, currency: 'EUR' }, benefits: ['Reports'] })])
  })

  it('forwards identity only for membership and returns provider redirects', async () => {
    configure()
    const fetcher = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({ ID: 'id_1', Provider: 'paystack', CheckoutURL: 'https://pay.test' }), { status: 201 })))
    vi.stubGlobal('fetch', fetcher)
    await startMembershipCheckout(new Actor(userId('reader'), []), { planID: 'supporter', email: 'reader@example.com', returnURL: 'https://site.test/support' })
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({ 'X-Kurasikapa-User': 'reader' })
    await startDonationCheckout({ amount: { minor: 5000, currency: 'GHS' }, email: 'reader@example.com', message: '', anonymous: false, returnURL: 'https://site.test/support' })
    expect(fetcher.mock.calls[1]?.[1]?.headers).not.toHaveProperty('X-Kurasikapa-User')
  })

  it('creates and explicitly activates a Studio membership tier', async () => {
    configure()
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'plan_1' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'plan_1', active: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(createAndActivateMembershipPlan(new Actor(userId('admin'), ['administrator']), { name: 'Supporter' })).resolves.toEqual({ id: 'plan_1' })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('surfaces provider problems and refuses commands without an API', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ type: 'payment_unavailable', title: 'Payments are not configured' }), { status: 503 })))
    await expect(startDonationCheckout({ amount: { minor: 5000, currency: 'GHS' }, email: 'reader@example.com', message: '', anonymous: false, returnURL: 'https://site.test/support' })).rejects.toThrow(/Payments are not configured/u)
    vi.stubEnv('API_URL', undefined); resetEnv()
    await expect(createAndActivateMembershipPlan(new Actor(userId('admin'), ['administrator']), {})).rejects.toThrow(/API_URL/u)
  })

  it('loads and normalises the protected revenue report', async () => {
    configure()
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ days: 7, activeSubscribers: 2, currencies: [{ currency: 'EUR', grossMinor: 12000, mrrMinor: 1000 }], trend: [{ date: '2026-08-31', currency: 'EUR', minor: 12000 }], subscribers: [{ id: 'sub_1', email: 'reader@example.com', status: 'active', price: { minor: 12000, currency: 'EUR' }, paidThrough: null }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    const actor = new Actor(userId('admin'), ['administrator'])
    await expect(loadRevenueReport(actor, 7)).resolves.toMatchObject({ days: 7, activeSubscribers: 2, currencies: [{ currency: 'EUR', grossMinor: 12000 }] })
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({ 'X-Kurasikapa-User': 'admin' })
    vi.stubEnv('API_URL', undefined); resetEnv()
    await expect(loadRevenueReport(actor, 30)).resolves.toMatchObject({ days: 30, subscribers: [] })
  })

  it('fails closed on report errors and normalises incomplete report rows', async () => {
    configure()
    const actor = new Actor(userId('admin'), ['administrator'])
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ type: 'not_permitted', title: 'Not permitted' }), { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ days: 'bad', currencies: [{ currency: 'USD' }], trend: 'bad', subscribers: [{ price: { Minor: 500, Currency: 'GHS' }, paidThrough: '2026-09-30T00:00:00Z' }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(loadRevenueReport(actor, 90)).rejects.toThrow(/Not permitted/u)
    await expect(loadRevenueReport(actor, 90)).resolves.toMatchObject({ days: 0, currencies: [{ currency: 'GHS', grossMinor: 0 }], trend: [], subscribers: [{ price: { minor: 500, currency: 'GHS' }, paidThrough: '2026-09-30T00:00:00Z' }] })
  })

  it('manages campaigns and normalises advertising reports', async () => {
    configure()
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ID: 'ad_1' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ID: 'ad_1', Active: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ campaigns: [{ ID: 'ad_1', Name: 'Launch', Advertiser: 'Acme', Slot: 'article_inline', Active: true, Budget: { Minor: 10000, Currency: 'GHS' }, Impressions: 2500, Clicks: 125, EstimatedSpendMinor: 2500, CTR: 5, StartsAt: '2026-08-31', EndsAt: '2026-09-30' }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    const actor = new Actor(userId('admin'), ['administrator'])
    await expect(createAndActivateAdCampaign(actor, { name: 'Launch' })).resolves.toEqual({ id: 'ad_1' })
    await expect(loadAdReport(actor)).resolves.toEqual([expect.objectContaining({ id: 'ad_1', slot: 'article_inline', impressions: 2500, ctr: 5, budget: { minor: 10000, currency: 'GHS' } })])
  })

  it('loads public placements and records anonymous delivery events', async () => {
    configure()
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ placement: { id: 'ad_1', advertiser: 'Acme', creativeUrl: 'https://cdn.test/ad.jpg', altText: 'Solar panels', landingUrl: 'https://example.com' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ placement: null }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(loadAdPlacement('en', 'home_leaderboard')).resolves.toMatchObject({ id: 'ad_1', advertiser: 'Acme' })
    await recordAdEvent('ad_1', 'impression')
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', body: '{"kind":"impression"}' })
    await expect(loadAdPlacement('fr', 'live_companion')).resolves.toBeNull()
  })

  it('uses safe advertising fallbacks without an API seam', async () => {
    configure(); vi.stubEnv('API_URL', undefined); resetEnv()
    const actor = new Actor(userId('admin'), ['administrator'])
    await expect(loadAdReport(actor)).resolves.toEqual([])
    await expect(loadAdPlacement('en', 'article_inline')).resolves.toBeNull()
    await expect(recordAdEvent('ad_1', 'click')).resolves.toBeUndefined()
  })
})
