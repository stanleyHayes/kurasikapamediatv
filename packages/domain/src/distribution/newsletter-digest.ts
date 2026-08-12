import type { Cadence } from '../audience/newsletter'

export interface NewsletterDigestProps {
  readonly id: string
  readonly cadence: Cadence
  readonly locale: string
  readonly periodKey: string
  readonly sentAt: Date
  readonly articleCount: number
  readonly recipientCount: number
}

export class InvalidDigestLocale extends Error {
  constructor(readonly value: string) {
    super('A digest needs a locale')
    this.name = 'InvalidDigestLocale'
  }
}

/**
 * One scheduled digest send. The id is cadence+locale+period so a second cron
 * tick the same day (or week) cannot mail the list again.
 */
export class NewsletterDigest {
  private constructor(private readonly props: NewsletterDigestProps) {}

  static reconstitute(props: NewsletterDigestProps): NewsletterDigest {
    return new NewsletterDigest(props)
  }

  static issue(input: {
    readonly cadence: Cadence
    readonly locale: string
    readonly periodKey: string
    readonly now: Date
    readonly articleCount: number
    readonly recipientCount: number
  }): NewsletterDigest {
    const locale = input.locale.trim()
    if (locale.length < 2) throw new InvalidDigestLocale(input.locale)

    return new NewsletterDigest({
      id: digestId(input.cadence, locale, input.periodKey),
      cadence: input.cadence,
      locale,
      periodKey: input.periodKey,
      sentAt: input.now,
      articleCount: input.articleCount,
      recipientCount: input.recipientCount,
    })
  }

  get id(): string {
    return this.props.id
  }

  snapshot(): NewsletterDigestProps {
    return this.props
  }
}

export function digestId(cadence: Cadence, locale: string, periodKey: string): string {
  return `${cadence}:${locale}:${periodKey}`
}
