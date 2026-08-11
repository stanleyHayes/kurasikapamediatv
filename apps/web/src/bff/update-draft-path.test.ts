import { Actor, userId } from '@kurasikapa/domain'
import { describe, expect, it, vi } from 'vitest'
import { updateDraft } from './update-draft-path'

const actor = new Actor(userId('usr_1'), [])
const parsed = { articleId: 'art_1', title: 'Budget', body: 'Text.' }

describe('updateDraft path', () => {
  it('uses TypeScript when API_URL is unset', async () => {
    const viaTypeScript = vi.fn().mockResolvedValue({ seq: 2, slug: 'budget' })
    const result = await updateDraft(actor, parsed, undefined, viaTypeScript)
    expect(result.seq).toBe(2)
    expect(viaTypeScript).toHaveBeenCalledOnce()
  })

  it('PATCHes Go when API_URL is set', async () => {
    const viaTypeScript = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ revisionId: 'rev_2', seq: 2, slug: 'budget' }), {
          status: 200,
        }),
      ),
    )
    try {
      const result = await updateDraft(actor, parsed, 'http://api.test', viaTypeScript)
      expect(result).toEqual({ revisionId: 'rev_2', seq: 2, slug: 'budget' })
      expect(viaTypeScript).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
