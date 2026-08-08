import type { Platform, SocialPost, SocialPostId } from '@kurasikapa/domain'
import type { Cursor, Page } from './pagination'

export interface SocialPostRepository {
  findById(id: SocialPostId): Promise<SocialPost | null>
  listQueue(cursor: Cursor): Promise<Page<SocialPost>>
  /** Everything whose moment has arrived. Drives the fan-out worker. */
  listDue(now: Date): Promise<readonly SocialPost[]>
  save(post: SocialPost): Promise<void>
}

export interface SocialTarget {
  readonly platform: Platform
  readonly caption: string
  /** Absolute, because it leaves our domain entirely. */
  readonly url: string
}

export interface SocialResult {
  /** The platform's own id, kept so a post can be traced or deleted later. */
  readonly externalId: string
}

/**
 * Publishing to a third party.
 *
 * One port for every platform: the differences between Facebook and Instagram
 * are adapter concerns, and a port per platform would push a switch statement
 * into the use case. Adding X or TikTok is a new adapter, not a new rule —
 * which is what the questionnaire's unconfirmed platform list needs.
 */
export interface SocialPublishPort {
  publish(target: SocialTarget): Promise<SocialResult>
}
