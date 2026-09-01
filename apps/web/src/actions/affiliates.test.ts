import { beforeEach, describe, expect, it, vi } from 'vitest'

const follow = vi.hoisted(() => vi.fn())
vi.mock('@kurasikapa/web-kit/bff/revenue', () => ({ followAffiliateLink: follow }))

import { followAffiliateAction } from './affiliates'

beforeEach(() => { follow.mockReset().mockResolvedValue('https://partner.example/books') })

describe('affiliate actions', () => {
  it('validates ids and returns only the server-resolved destination', async () => {
    await expect(followAffiliateAction({ id: 'affiliate_1' })).resolves.toEqual({ ok: true, data: { destinationURL: 'https://partner.example/books' } })
    expect(follow).toHaveBeenCalledWith('affiliate_1')
    await expect(followAffiliateAction({ id: '' })).resolves.toMatchObject({ ok: false })
  })
})
