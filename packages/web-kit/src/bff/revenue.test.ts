import { afterEach, describe, expect, it, vi } from 'vitest'
import { Actor, userId } from '@kurasikapa/domain'
import { createAndActivateMembershipPlan, loadMembershipPlans, startDonationCheckout, startMembershipCheckout } from './revenue'
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
})
