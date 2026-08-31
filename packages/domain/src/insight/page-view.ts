import type { ArticleId } from '../shared/ids'

export const ACQUISITION_CHANNELS = ['direct', 'search', 'social', 'newsletter', 'referral'] as const
export type AcquisitionChannel = (typeof ACQUISITION_CHANNELS)[number]

export interface PageViewProps {
  readonly id: string
  readonly articleId: ArticleId
  readonly locale: string
  readonly visitorHash: string
  readonly channel: AcquisitionChannel
  readonly occurredAt: Date
}

/** Append-only audience event. The visitor token is hashed before it enters the domain. */
export class PageView {
  private constructor(private readonly props: PageViewProps) {}

  static record(props: PageViewProps): PageView {
    if (!/^[a-f\d]{64}$/u.test(props.visitorHash)) throw new Error('Invalid visitor hash')
    if (!ACQUISITION_CHANNELS.includes(props.channel)) throw new Error('Invalid acquisition channel')
    return new PageView(props)
  }

  snapshot(): PageViewProps { return { ...this.props } }
}
