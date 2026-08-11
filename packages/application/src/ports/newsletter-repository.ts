import type { NewsletterSubscription } from '@kurasikapa/domain'

export interface NewsletterRepository {
  findByEmail(email: string): Promise<NewsletterSubscription | null>
  findByToken(token: string): Promise<NewsletterSubscription | null>
  listConfirmed(locale: string): Promise<readonly NewsletterSubscription[]>
  save(subscription: NewsletterSubscription): Promise<void>
}
