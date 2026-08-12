import type { NewsletterDigest } from '@kurasikapa/domain'
import type { NewsletterDigestRepository } from '../ports/newsletter-digest-repository'

export class InMemoryNewsletterDigestRepository implements NewsletterDigestRepository {
  private readonly rows = new Map<string, NewsletterDigest>()

  findById(id: string): Promise<NewsletterDigest | null> {
    return Promise.resolve(this.rows.get(id) ?? null)
  }

  save(digest: NewsletterDigest): Promise<void> {
    this.rows.set(digest.id, digest)
    return Promise.resolve()
  }
}
