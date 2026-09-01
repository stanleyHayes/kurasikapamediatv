import type { ArticleId } from '../shared/ids'

export const READING_DEPTHS = [25, 50, 75, 100] as const
export type ReadingDepth = (typeof READING_DEPTHS)[number]

export interface ArticleEngagementProps {
  readonly id: string
  readonly articleId: ArticleId
  readonly locale: string
  readonly visitorHash: string
  readonly scrollDepth: ReadingDepth
  readonly activeSeconds: number
  readonly occurredAt: Date
}

/** Privacy-safe attention event: no pointer coordinates, selections or raw identity. */
export class ArticleEngagement {
  private constructor(private readonly props: ArticleEngagementProps) {}

  static record(props: ArticleEngagementProps): ArticleEngagement {
    if (!/^[a-f\d]{64}$/u.test(props.visitorHash)) throw new Error('Invalid visitor hash')
    if (!READING_DEPTHS.includes(props.scrollDepth)) throw new Error('Invalid scroll depth')
    if (!Number.isInteger(props.activeSeconds) || props.activeSeconds < 0 || props.activeSeconds > 3_600) {
      throw new Error('Invalid active seconds')
    }
    return new ArticleEngagement(props)
  }

  snapshot(): ArticleEngagementProps { return { ...this.props } }
}
