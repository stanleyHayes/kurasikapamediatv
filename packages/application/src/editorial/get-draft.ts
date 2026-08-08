import { type Actor, type Article, type ArticleId, type Revision } from '@kurasikapa/domain'
import type { ArticleRepository } from '../ports/article-repository'
import type { RevisionRepository } from '../ports/revision-repository'
import type { UseCase } from '../ports/use-case'
import { ArticleNotFound } from './errors'

export interface GetDraftDeps {
  readonly articles: ArticleRepository
  readonly revisions: RevisionRepository
}

export interface GetDraftInput {
  readonly actor: Actor
  readonly articleId: ArticleId
}

export interface DraftForEditing {
  readonly article: Article
  /** Null only for an article whose first revision has not landed yet. */
  readonly latest: Revision | null
}

/**
 * Loads an article and its current text for the editor.
 *
 * Authorisation is not optional here even though this only reads: an
 * unpublished draft is confidential until the newsroom decides otherwise, and
 * "it is only a GET" is how internal leaks happen.
 */
export class GetDraft implements UseCase<GetDraftInput, DraftForEditing> {
  constructor(private readonly deps: GetDraftDeps) {}

  async execute(input: GetDraftInput): Promise<DraftForEditing> {
    const article = await this.deps.articles.findById(input.articleId)
    if (article === null) throw new ArticleNotFound(input.articleId)

    // An author may open their own work; anyone who may edit any article may
    // open all of it. Throws NotOwnArticle or NotPermitted otherwise.
    article.assertReadableBy(input.actor)

    const latest = await this.deps.revisions.findLatest(article.id)

    return { article, latest }
  }
}
