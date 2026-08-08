import type { Article } from '../editorial/article'
import { isPubliclyVisible } from '../editorial/article-status'
import type { ArticleId, UserId } from '../shared/ids'

export interface BookmarkProps {
  readonly readerId: UserId
  readonly articleId: ArticleId
  readonly locale: string
  readonly savedAt: Date
}

export class CannotSaveUnpublished extends Error {
  constructor(readonly articleId: ArticleId) {
    super(`Article ${articleId} is not published and cannot be saved`)
    this.name = 'CannotSaveUnpublished'
  }
}

/**
 * A reader's saved article.
 *
 * Saving is refused for anything not published — otherwise a reader who
 * happened to learn a draft's id could keep a handle on it and watch for the
 * moment it appears. The rule lives here rather than in the repository so it
 * is tested without a database, like every other rule.
 *
 * Locale is stored rather than derived: an article family has one entry per
 * language, and the reader saved a specific one.
 */
export class Bookmark {
  private constructor(private readonly props: BookmarkProps) {}

  static reconstitute(props: BookmarkProps): Bookmark {
    return new Bookmark(props)
  }

  static create(readerId: UserId, article: Article, now: Date): Bookmark {
    if (!isPubliclyVisible(article.status)) throw new CannotSaveUnpublished(article.id)

    return new Bookmark({
      readerId,
      articleId: article.id,
      locale: article.locale,
      savedAt: now,
    })
  }

  get readerId(): UserId { return this.props.readerId }
  get articleId(): ArticleId { return this.props.articleId }
  get locale(): string { return this.props.locale }
  get savedAt(): Date { return this.props.savedAt }

  /** True when this bookmark belongs to the reader asking. */
  belongsTo(readerId: UserId): boolean {
    return this.props.readerId === readerId
  }

  snapshot(): BookmarkProps {
    return this.props
  }
}
