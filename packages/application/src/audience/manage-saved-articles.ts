import type { Actor, Article, ArticleId } from '@kurasikapa/domain'
import type { ArticleRepository } from '../ports/article-repository'
import type { BookmarkRepository } from '../ports/bookmark-repository'
import { type Page, clampLimit } from '../ports/pagination'
import type { UseCase } from '../ports/use-case'

export interface SavedArticlesDeps {
  readonly bookmarks: BookmarkRepository
  readonly articles: ArticleRepository
}

export interface RemoveSavedArticleInput {
  readonly actor: Actor
  readonly articleId: ArticleId
}

/**
 * Removes an article from the reader's own list.
 *
 * Removing one that was never saved succeeds: un-saving is a desired end
 * state, not a transaction, and a reader tapping twice should not see an error.
 */
export class RemoveSavedArticle implements UseCase<RemoveSavedArticleInput, { saved: false }> {
  constructor(private readonly deps: SavedArticlesDeps) {}

  async execute(input: RemoveSavedArticleInput): Promise<{ saved: false }> {
    await this.deps.bookmarks.remove(input.actor.id, input.articleId)

    return { saved: false }
  }
}

export interface ListSavedArticlesInput {
  readonly actor: Actor
  readonly after?: string | undefined
  readonly limit?: number | undefined
}

const LIMITS = { fallback: 20, max: 100 }

/**
 * The reader's own saved list.
 *
 * Takes no reader id — only the actor. A `readerId` parameter would make one
 * person's reading list readable by editing a query string, and what someone
 * reads is among the most sensitive data this platform holds.
 */
export class ListSavedArticles implements UseCase<ListSavedArticlesInput, Page<Article>> {
  constructor(private readonly deps: SavedArticlesDeps) {}

  /**
   * Returns articles, not bookmarks.
   *
   * The join belongs here rather than in the page: a caller that received raw
   * bookmarks would need the article repository to render anything, and route
   * code reaching for a repository is the boundary this design exists to keep.
   *
   * One batch read for the page — a 20-item list would otherwise be 21 round
   * trips — and the reader's own order is preserved, because "most recently
   * saved" is what a saved list means.
   */
  async execute(input: ListSavedArticlesInput): Promise<Page<Article>> {
    const page = await this.deps.bookmarks.listFor(input.actor.id, {
      after: input.after,
      limit: clampLimit(input.limit, LIMITS),
    })

    const ids = page.items.map((b) => b.articleId)
    const found = await this.deps.articles.findManyByIds(ids)
    const byId = new Map(found.map((a) => [String(a.id), a]))

    // An article deleted since it was saved simply drops out of the list
    // rather than rendering as a blank row.
    const ordered = ids.map((id) => byId.get(String(id))).filter((a): a is Article => a !== undefined)

    return { items: ordered, nextCursor: page.nextCursor }
  }
}
