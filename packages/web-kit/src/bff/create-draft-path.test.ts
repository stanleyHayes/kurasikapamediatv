import { Actor, userId } from '@kurasikapa/domain'
import { describe, expect, it, vi } from 'vitest'
import { createDraft } from './create-draft-path'

const actor = new Actor(userId('usr_1'), [])

const parsed = {
  locale: 'en',
  title: 'Budget',
  body: '…',
  categoryId: 'cat_1',
}

describe('createDraft path', () => {
  it('uses TypeScript when API_URL is unset', async () => {
    const viaTypeScript = vi.fn().mockResolvedValue({ slug: 'budget' })

    const result = await createDraft(actor, parsed, undefined, viaTypeScript)

    expect(result.slug).toBe('budget')
    expect(viaTypeScript).toHaveBeenCalledOnce()
  })

  it('skips TypeScript when API_URL is set', async () => {
    const viaTypeScript = vi.fn()
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'art_1',
          familyId: 'fam_1',
          locale: 'en',
          slug: 'budget',
          title: 'Budget',
          status: 'draft',
          publishedAt: null,
        }),
        { status: 201 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    try {
      const result = await createDraft(actor, parsed, 'http://localhost:8080', viaTypeScript)

      expect(result.slug).toBe('budget')
      expect(viaTypeScript).not.toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledOnce()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
