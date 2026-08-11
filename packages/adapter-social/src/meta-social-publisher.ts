import type { SocialPublishPort, SocialResult, SocialTarget } from '@kurasikapa/application'

export interface MetaGraphConfig {
  readonly pageAccessToken: string | undefined
  readonly pageId: string | undefined
  readonly igUserId: string | undefined
  readonly post: typeof fetch
}

/**
 * Facebook Graph / Instagram Graph publisher.
 *
 * Fail-closed: an unset page token throws, so PublishDuePosts records a
 * visible failure and retries rather than reporting a send that never left
 * the building. Live posting still needs Meta app review; this adapter is
 * the door, not a fake success.
 */
export class MetaSocialPublisher implements SocialPublishPort {
  constructor(private readonly config: MetaGraphConfig) {}

  async publish(target: SocialTarget): Promise<SocialResult> {
    if (this.config.pageAccessToken === undefined || this.config.pageAccessToken === '') {
      throw new Error('Social publishing is not configured: META_PAGE_ACCESS_TOKEN is unset')
    }

    if (target.platform === 'instagram') {
      return this.publishInstagram()
    }

    return this.publishFacebook(target, this.config.pageAccessToken)
  }

  private publishInstagram(): Promise<SocialResult> {
    if (this.config.igUserId === undefined || this.config.igUserId === '') {
      return Promise.reject(
        new Error('Instagram publishing is not configured: META_IG_USER_ID is unset'),
      )
    }

    // Feed posts on Instagram require a media container. A link-only queue
    // item cannot be posted without inventing an image, which we will not do.
    return Promise.reject(
      new Error('Instagram Graph cannot publish a link-only post; a media container is required'),
    )
  }

  private async publishFacebook(target: SocialTarget, token: string): Promise<SocialResult> {
    const pageId = this.config.pageId
    if (pageId === undefined || pageId === '') {
      throw new Error('Facebook publishing is not configured: META_PAGE_ID is unset')
    }

    const url = `https://graph.facebook.com/v21.0/${pageId}/feed`
    const body = new URLSearchParams({
      message: target.caption,
      link: target.url,
      access_token: token,
    })

    const response = await this.config.post(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    return readResult(response)
  }
}

async function readResult(response: Response): Promise<SocialResult> {
  const payload: unknown = await response.json()

  if (!response.ok) {
    throw new Error(graphMessage(payload, `Graph API ${String(response.status)}`))
  }

  if (!isObject(payload) || typeof payload['id'] !== 'string') {
    throw new Error('Graph API returned no post id')
  }

  return { externalId: payload['id'] }
}

function graphMessage(payload: unknown, fallback: string): string {
  if (!isObject(payload)) return fallback
  const error = payload['error']
  if (!isObject(error) || typeof error['message'] !== 'string') return fallback
  return error['message']
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
