import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({ record: vi.fn(), membership: vi.fn(), donation: vi.fn(), proposal: vi.fn() }))

vi.mock('@kurasikapa/web-kit/composition/actor', () => ({
  NotSignedIn: class NotSignedIn extends Error {},
  requireActor: vi.fn(() => Promise.resolve({ id: 'reader' })),
}))
vi.mock('@kurasikapa/web-kit/composition/env', () => ({ env: () => ({ APP_URL: 'https://kurasikapa.test' }) }))
vi.mock('@kurasikapa/web-kit/bff/revenue', () => ({
  recordAdEvent: calls.record,
  startMembershipCheckout: calls.membership,
  startDonationCheckout: calls.donation,
  submitAdvertiserProposal: calls.proposal,
}))

import { recordAdEventAction, startDonationAction, startMembershipAction, submitAdvertiserProposalAction } from './revenue-actions'

beforeEach(() => {
  calls.record.mockReset().mockResolvedValue(undefined)
  calls.membership.mockReset().mockResolvedValue({ id: 'sub_1', provider: 'paystack', checkoutURL: 'https://pay.test' })
  calls.donation.mockReset().mockResolvedValue({ id: 'don_1', provider: 'stripe', checkoutURL: 'https://pay.test' })
  calls.proposal.mockReset().mockResolvedValue({ id: 'proposal_1', status: 'submitted' })
})

describe('revenue actions', () => {
  it('validates and records anonymous advertising events', async () => {
    await expect(recordAdEventAction({ campaignId: 'ad_1', kind: 'impression' })).resolves.toEqual({ ok: true, data: {} })
    expect(calls.record).toHaveBeenCalledWith('ad_1', 'impression')
    await expect(recordAdEventAction({ campaignId: '', kind: 'view' })).resolves.toMatchObject({ ok: false })
  })

  it('builds trusted return URLs for membership and donation checkout', async () => {
    await expect(startMembershipAction({ planID: 'supporter', email: 'reader@example.com', locale: 'en' })).resolves.toMatchObject({ ok: true })
    expect(calls.membership).toHaveBeenCalledWith({ id: 'reader' }, expect.objectContaining({ returnURL: 'https://kurasikapa.test/en/support?checkout=return' }))
    await expect(startDonationAction({ amountMinor: 5000, currency: 'EUR', email: 'reader@example.com', message: '', anonymous: false, locale: 'fr' })).resolves.toMatchObject({ ok: true })
    expect(calls.donation).toHaveBeenCalledWith(expect.objectContaining({ returnURL: 'https://kurasikapa.test/fr/support?checkout=return' }))
  })

  it('validates and submits a campaign proposal under the current actor', async () => {
    const input = { contactName: 'Ama Mensah', contactEmail: 'ama@example.com', name: 'September launch', advertiser: 'Acme Ghana', locale: '*', slot: 'live_companion', creativeURL: 'https://cdn.test/ad.jpg', altText: 'Solar systems on a rooftop', landingURL: 'https://example.com', currency: 'GHS', budgetMinor: 10000, cpmMinor: 1000, priority: 80, startsAt: '2026-09-02T10:00:00.000Z', endsAt: '2026-10-02T10:00:00.000Z' }
    await expect(submitAdvertiserProposalAction(input)).resolves.toMatchObject({ ok: true, data: { id: 'proposal_1' } })
    expect(calls.proposal).toHaveBeenCalled()
    expect(JSON.stringify(calls.proposal.mock.calls[0])).toContain('"locale":"*"')
    expect(JSON.stringify(calls.proposal.mock.calls[0])).toContain('"minor":10000')
    await expect(submitAdvertiserProposalAction({ ...input, endsAt: input.startsAt })).resolves.toMatchObject({ ok: false })
  })
})
