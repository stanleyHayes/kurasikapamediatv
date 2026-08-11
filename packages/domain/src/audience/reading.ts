import type { Article } from '../editorial/article'
import { isPubliclyVisible } from '../editorial/article-status'
import type { ArticleId, UserId } from '../shared/ids'

export interface ReadingProps {
  readonly readerId: UserId
  readonly articleId: ArticleId
  readonly locale: string
  readonly readAt: Date
}

export class CannotRecordUnpublished extends Error {
  constructor(readonly articleId: ArticleId) {
    super(`Article ${articleId} is not published and cannot enter reading history`)
    this.name = 'CannotRecordUnpublished'
  }
}

/**
 * A reader's visit to a published article.
 *
 * Locale is stored rather than derived: rereading the French version is not
 * the same visit as the English one. Unpublished articles are refused so a
 * leaked draft id cannot become a private watchlist.
 */
export class Reading {
  private constructor(private readonly props: ReadingProps) {}

  static reconstitute(props: ReadingProps): Reading {
    return new Reading(props)
  }

  static record(readerId: UserId, article: Article, now: Date): Reading {
    if (!isPubliclyVisible(article.status)) throw new CannotRecordUnpublished(article.id)

    return new Reading({
      readerId,
      articleId: article.id,
      locale: article.locale,
      readAt: now,
    })
  }

  get readerId(): UserId {
    return this.props.readerId
  }

  get articleId(): ArticleId {
    return this.props.articleId
  }

  get locale(): string {
    return this.props.locale
  }

  get readAt(): Date {
    return this.props.readAt
  }

  snapshot(): ReadingProps {
    return this.props
  }
}
