import {
  type Actor,
  type Article,
  type ArticleId,
  BreakingAlert,
} from '@kurasikapa/domain'
import { ArticleNotFound } from '../editorial/errors'
import { EmailDeliveryFailed } from '../audience/subscribe-newsletter'
import type { ClockPort } from '../ports/ambient'
import type { ArticleRepository } from '../ports/article-repository'
import type { BreakingAlertRepository } from '../ports/breaking-alert-repository'
import type { EmailMessage, EmailPort } from '../ports/email'
import type { NewsletterRepository } from '../ports/newsletter-repository'
import type { UseCase } from '../ports/use-case'

export class BreakingAlertAlreadySent extends Error {
  constructor(readonly articleId: ArticleId) {
    super(`A breaking alert has already been sent for ${articleId}`)
    this.name = 'BreakingAlertAlreadySent'
  }
}

export interface SendBreakingAlertDeps {
  readonly articles: ArticleRepository
  readonly subscriptions: NewsletterRepository
  readonly alerts: BreakingAlertRepository
  readonly email: EmailPort
  readonly clock: ClockPort
  readonly siteUrl: string
}

export interface SendBreakingAlertInput {
  readonly actor: Actor
  readonly articleId: ArticleId
}

/**
 * Mails confirmed subscribers in the article's locale. Fail-closed on the
 * mailer. One successful send per article — a second click is not a digest.
 */
export class SendBreakingAlert implements UseCase<
  SendBreakingAlertInput,
  { sent: number }
> {
  constructor(private readonly deps: SendBreakingAlertDeps) {}

  async execute(input: SendBreakingAlertInput): Promise<{ sent: number }> {
    const article = await this.deps.articles.findById(input.articleId)
    if (article === null) throw new ArticleNotFound(input.articleId)

    const alert = BreakingAlert.issue(input.actor, article, this.deps.clock.now())
    if ((await this.deps.alerts.findByArticleId(article.id)) !== null) {
      throw new BreakingAlertAlreadySent(article.id)
    }

    const recipients = await this.deps.subscriptions.listConfirmed(article.locale)
    const addresses = recipients.map((row) => row.email)
    if (addresses.length > 0) await this.mail(addresses, article)
    await this.deps.alerts.save(alert)

    return { sent: recipients.length }
  }

  private async mail(to: readonly string[], article: Article): Promise<void> {
    try {
      await this.deps.email.sendBatch(to.map((address) => letter(address, article, this.deps.siteUrl)))
    } catch {
      throw new EmailDeliveryFailed()
    }
  }
}

function letter(to: string, article: Article, siteUrl: string): EmailMessage {
  const props = article.snapshot()
  const path = `${siteUrl}/${props.locale}/articles/${props.slug.value}`

  return {
    to,
    subject: `Breaking: ${props.title}`,
    text: `${props.title}\n${path}\n\nUnsubscribe: ${siteUrl}/${props.locale}/newsletter/unsubscribe\n`,
  }
}
