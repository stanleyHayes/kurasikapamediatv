import { type Actor, type ArticleId, Bookmark } from '@kurasikapa/domain'
import { ArticleNotFound } from '../editorial/errors'
import type { ClockPort } from '../ports/ambient'
import type { ArticleRepository } from '../ports/article-repository'
import type { BookmarkRepository } from '../ports/bookmark-repository'
import type { UseCase } from '../ports/use-case'

export interface SaveArticleDeps {
  readonly bookmarks: BookmarkRepository
  readonly articles: ArticleRepository
  readonly clock: ClockPort
}

export interface SaveArticleInput {
  readonly actor: Actor
  readonly articleId: ArticleId
}

/**
 * Saves an article to the reader's own list.
 *
 * No permission check, because any signed-in reader may save — that is the
 * feature. The protection that matters is scoping: everything uses
 * `actor.id`, and no port here accepts a reader id from the caller, so there
 * is no request shape that touches someone else's list.
 *
 * Idempotent. A double-tap on a bookmark button should not show a failure.
 */
export class SaveArticle implements UseCase<SaveArticleInput, { saved: true }> {
  constructor(private readonly deps: SaveArticleDeps) {}

  async execute(input: SaveArticleInput): Promise<{ saved: true }> {
    const article = await this.deps.articles.findById(input.articleId)
    if (article === null) throw new ArticleNotFound(input.articleId)

    // Throws CannotSaveUnpublished for anything a reader should not be able to
    // hold a handle on.
    const bookmark = Bookmark.create(input.actor.id, article, this.deps.clock.now())
    await this.deps.bookmarks.save(bookmark)

    return { saved: true }
  }
}
