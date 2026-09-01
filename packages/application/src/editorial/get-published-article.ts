import { type Article, isPubliclyVisible } from '@kurasikapa/domain'
import type { ArticleRepository } from '../ports/article-repository'
import type { RevisionRepository } from '../ports/revision-repository'
import type { UseCase } from '../ports/use-case'

export interface GetPublishedArticleDeps {
  readonly articles: ArticleRepository
  readonly revisions: RevisionRepository
}

export interface PublishedArticle {
  readonly article: Article
  /**
   * The text of the APPROVED revision, not the latest.
   *
   * An editor may already be drafting a correction; readers must see what was
   * approved, not what is being written. Null only if the approval predates
   * any stored revision.
   */
  readonly body: string | null
	/** Timestamp of the approved public revision, never an unapproved edit. */
	readonly modifiedAt: Date | null
}

export interface GetPublishedArticleInput {
  readonly slug: string
  readonly locale: string
}

/**
 * The reader-facing article lookup.
 *
 * Visibility is decided by the domain, not by a repository filter. A query that
 * merely forgot `status: 'published'` would serve an unpublished draft to the
 * public — so the check lives where it can be tested without a database, and
 * happens even though the repository could have filtered it.
 */
export class GetPublishedArticle
  implements UseCase<GetPublishedArticleInput, PublishedArticle | null>
{
  constructor(private readonly deps: GetPublishedArticleDeps) {}

  async execute(input: GetPublishedArticleInput): Promise<PublishedArticle | null> {
    const article = await this.deps.articles.findBySlug(input.slug, input.locale)
    if (article === null) return null
    if (!isPubliclyVisible(article.status)) return null

    const approvedId = article.snapshot().approvedRevisionId
    const approved = approvedId === null ? null : await this.deps.revisions.findById(approvedId)

    return { article, body: approved?.body ?? null, modifiedAt: approved?.createdAt ?? null }
  }
}
