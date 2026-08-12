import type { NewsletterDigest } from '@kurasikapa/domain'

export interface NewsletterDigestRepository {
  findById(id: string): Promise<NewsletterDigest | null>
  save(digest: NewsletterDigest): Promise<void>
}
