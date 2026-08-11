import type { NewsletterSubscription } from '@kurasikapa/domain'
import type { NewsletterRepository } from '../ports/newsletter-repository'

export class InMemoryNewsletterRepository implements NewsletterRepository {
  private readonly rows = new Map<string, NewsletterSubscription>()

  findByEmail(email: string): Promise<NewsletterSubscription | null> {
    return Promise.resolve(this.rows.get(email) ?? null)
  }

  findByToken(token: string): Promise<NewsletterSubscription | null> {
    return Promise.resolve([...this.rows.values()].find((row) => row.token === token) ?? null)
  }

  listConfirmed(locale: string): Promise<readonly NewsletterSubscription[]> {
    return Promise.resolve(
      [...this.rows.values()].filter(
        (row) => row.state === 'confirmed' && row.locales.includes(locale),
      ),
    )
  }

  save(subscription: NewsletterSubscription): Promise<void> {
    this.rows.set(subscription.email, subscription)
    return Promise.resolve()
  }
}
