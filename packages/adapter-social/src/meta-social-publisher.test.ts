import { describe, expect, it, vi } from 'vitest'
import { MetaSocialPublisher } from './meta-social-publisher'

const target = {
  platform: 'facebook' as const,
  caption: 'Hello',
  url: 'https://example.com/articles/x',
}

describe('MetaSocialPublisher', () => {
  it('fails closed when the page token is unset', async () => {
    const social = new MetaSocialPublisher({
      pageAccessToken: undefined,
      pageId: '1',
      igUserId: undefined,
      post: vi.fn(),
    })

    await expect(social.publish(target)).rejects.toThrow(/META_PAGE_ACCESS_TOKEN/u)
  })

  it('fails closed when the Facebook page id is unset', async () => {
    const social = new MetaSocialPublisher({
      pageAccessToken: 'token',
      pageId: undefined,
      igUserId: undefined,
      post: vi.fn(),
    })

    await expect(social.publish(target)).rejects.toThrow(/META_PAGE_ID/u)
  })

  it('posts a Facebook feed item and returns the Graph id', async () => {
    const post = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'page_post' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const social = new MetaSocialPublisher({
      pageAccessToken: 'token',
      pageId: '99',
      igUserId: undefined,
      post,
    })

    await expect(social.publish(target)).resolves.toEqual({ externalId: 'page_post' })
    expect(post).toHaveBeenCalledOnce()
  })

  it('surfaces a Graph error message', async () => {
    const post = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'expired token' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const social = new MetaSocialPublisher({
      pageAccessToken: 'token',
      pageId: '99',
      igUserId: undefined,
      post,
    })

    await expect(social.publish(target)).rejects.toThrow(/expired token/u)
  })

  it('rejects a success payload with no post id', async () => {
    const post = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const social = new MetaSocialPublisher({
      pageAccessToken: 'token',
      pageId: '99',
      igUserId: undefined,
      post,
    })

    await expect(social.publish(target)).rejects.toThrow(/no post id/u)
  })

  it('refuses Instagram when the IG user id is unset', async () => {
    const social = new MetaSocialPublisher({
      pageAccessToken: 'token',
      pageId: '99',
      igUserId: undefined,
      post: vi.fn(),
    })

    await expect(
      social.publish({ ...target, platform: 'instagram' }),
    ).rejects.toThrow(/META_IG_USER_ID/u)
  })

  it('refuses Instagram link-only posts rather than inventing media', async () => {
    const social = new MetaSocialPublisher({
      pageAccessToken: 'token',
      pageId: '99',
      igUserId: 'ig',
      post: vi.fn(),
    })

    await expect(
      social.publish({ ...target, platform: 'instagram' }),
    ).rejects.toThrow(/media container/u)
  })
})
