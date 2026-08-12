import type { Article, Cadence } from '@kurasikapa/domain'
import { NewsletterDigest, digestId } from '@kurasikapa/domain'
import { EmailDeliveryFailed } from '../audience/subscribe-newsletter'
import type { ClockPort } from '../ports/ambient'
import type { ArticleRepository } from '../ports/article-repository'
import type { EmailMessage, EmailPort } from '../ports/email'
import type { NewsletterDigestRepository } from '../ports/newsletter-digest-repository'
import type { NewsletterRepository } from '../ports/newsletter-repository'
import type { UseCase } from '../ports/use-case'

export class DigestAlreadySent extends Error {
  constructor(readonly digestId: string) {
    super(`Digest ${digestId} has already been sent`)
    this.name = 'DigestAlreadySent'
  }
}

export interface SendNewsletterDigestDeps {
  readonly articles: ArticleRepository
  readonly subscriptions: NewsletterRepository
  readonly digests: NewsletterDigestRepository
  readonly email: EmailPort
  readonly clock: ClockPort
  readonly siteUrl: string
}

export interface SendNewsletterDigestInput {
  readonly cadence: Cadence
  readonly locale: string
  /** Composition computes this from the clock — keeps Date math out of the use case. */
  readonly periodKey: string
  readonly since: Date
}

/**
 * Mails confirmed subscribers for one cadence and locale. Fail-closed on the
 * mailer. Empty windows still latch so a quiet day does not retry forever.
 */
export class SendNewsletterDigest implements UseCase<
  SendNewsletterDigestInput,
  { sent: number; articles: number }
> {
  constructor(private readonly deps: SendNewsletterDigestDeps) {}

  async execute(
    input: SendNewsletterDigestInput,
  ): Promise<{ sent: number; articles: number }> {
    const now = this.deps.clock.now()
    const id = digestId(input.cadence, input.locale.trim(), input.periodKey)
    if ((await this.deps.digests.findById(id)) !== null) {
      throw new DigestAlreadySent(id)
    }

    const stories = await this.stories(input.locale, input.since)
    const recipients = (await this.deps.subscriptions.listConfirmed(input.locale)).filter(
      (row) => row.cadence === input.cadence,
    )
    if (recipients.length > 0 && stories.length > 0) {
      await this.mail(
        recipients.map((row) => row.email),
        stories,
        input.locale,
      )
    }

    await this.deps.digests.save(
      NewsletterDigest.issue({
        cadence: input.cadence,
        locale: input.locale,
        periodKey: input.periodKey,
        now,
        articleCount: stories.length,
        recipientCount: recipients.length,
      }),
    )

    return { sent: stories.length === 0 ? 0 : recipients.length, articles: stories.length }
  }

  private async stories(locale: string, since: Date): Promise<readonly Article[]> {
    const page = await this.deps.articles.listPublished({ locale, limit: 50 })
    return page.items.filter((article) => {
      const at = article.publishedAt
      return at !== null && at.getTime() >= since.getTime()
    })
  }

  private async mail(
    to: readonly string[],
    stories: readonly Article[],
    locale: string,
  ): Promise<void> {
    try {
      await this.deps.email.sendBatch(
        to.map((address) => letter(address, stories, locale, this.deps.siteUrl)),
      )
    } catch {
      throw new EmailDeliveryFailed()
    }
  }
}

function letter(
  to: string,
  stories: readonly Article[],
  locale: string,
  siteUrl: string,
): EmailMessage {
  const lines = stories.map((article) => {
    const props = article.snapshot()
    return `- ${props.title}\n  ${siteUrl}/${locale}/articles/${props.slug.value}`
  })

  return {
    to,
    subject: `Kurasikapa briefing (${locale})`,
    text: `Today's briefing:\n\n${lines.join('\n\n')}\n\nUnsubscribe: ${siteUrl}/${locale}/newsletter/unsubscribe\n`,
  }
}
