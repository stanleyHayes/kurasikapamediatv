import type { SocialPost, SocialPostId } from '@kurasikapa/domain'
import type { Cursor, Page } from '../ports/pagination'
import type {
  SocialPostRepository,
  SocialPublishPort,
  SocialResult,
  SocialTarget,
} from '../ports/social'

export class InMemorySocialPostRepository implements SocialPostRepository {
  private readonly store = new Map<string, SocialPost>()

  constructor(seed: readonly SocialPost[] = []) {
    for (const p of seed) this.store.set(p.id, p)
  }

  findById(id: SocialPostId): Promise<SocialPost | null> {
    return Promise.resolve(this.store.get(id) ?? null)
  }

  listQueue(cursor: Cursor): Promise<Page<SocialPost>> {
    const all = [...this.store.values()].sort(
      (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime(),
    )

    return Promise.resolve({ items: all.slice(0, cursor.limit), nextCursor: null })
  }

  listDue(now: Date): Promise<readonly SocialPost[]> {
    return Promise.resolve([...this.store.values()].filter((p) => p.isDue(now)))
  }

  save(post: SocialPost): Promise<void> {
    this.store.set(post.id, post)
    return Promise.resolve()
  }
}

/** Records what it was asked to publish. */
export class RecordingSocial implements SocialPublishPort {
  readonly published: SocialTarget[] = []

  publish(target: SocialTarget): Promise<SocialResult> {
    this.published.push(target)
    return Promise.resolve({ externalId: `ext_${String(this.published.length)}` })
  }
}

/** Fails for one platform only — the realistic outage, not a total one. */
export class FlakySocial implements SocialPublishPort {
  readonly published: SocialTarget[] = []

  constructor(private readonly failing: string) {}

  publish(target: SocialTarget): Promise<SocialResult> {
    if (target.platform === this.failing) {
      return Promise.reject(new Error(`${this.failing} token expired`))
    }

    this.published.push(target)
    return Promise.resolve({ externalId: 'ext_ok' })
  }
}
