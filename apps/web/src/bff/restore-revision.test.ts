import { Actor, userId } from '@kurasikapa/domain'
import { afterEach, describe, expect, it, vi } from 'vitest'

const apiUrl = vi.hoisted(() => ({ current: undefined as string | undefined }))

vi.mock('../composition/env', () => ({
  env: () => ({ API_URL: apiUrl.current }),
}))

import { restoreRevision } from './restore-revision'

const actor = new Actor(userId('usr_1'), [])

describe('restoreRevision', () => {
  afterEach(() => {
    apiUrl.current = undefined
    vi.unstubAllGlobals()
  })

  it('uses TypeScript when API_URL is unset', async () => {
    const viaTypeScript = vi.fn().mockResolvedValue({ seq: 3 })
    const result = await restoreRevision(
      actor,
      { articleId: 'art_1', revisionId: 'rev_1' },
      viaTypeScript,
    )
    expect(result.seq).toBe(3)
    expect(viaTypeScript).toHaveBeenCalledOnce()
  })

  it('posts to Go when API_URL is set', async () => {
    apiUrl.current = 'http://api.test'
    const viaTypeScript = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ seq: 4 }), { status: 200 }),
      ),
    )

    const result = await restoreRevision(
      actor,
      { articleId: 'art_1', revisionId: 'rev_1' },
      viaTypeScript,
    )
    expect(result.seq).toBe(4)
    expect(viaTypeScript).not.toHaveBeenCalled()
  })

  it('rejects an unrecognised restore body', async () => {
    apiUrl.current = 'http://api.test'
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 }),
      ),
    )
    await expect(
      restoreRevision(actor, { articleId: 'art_1', revisionId: 'rev_1' }, vi.fn()),
    ).rejects.toThrow(/unrecognised restore body/u)
  })
})
