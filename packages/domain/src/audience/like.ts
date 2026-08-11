import type { Article } from '../editorial/article'
import { isPubliclyVisible } from '../editorial/article-status'
import type { ArticleId, UserId } from '../shared/ids'

export interface LikeProps {
  readonly readerId: UserId
  readonly articleId: ArticleId
  readonly likedAt: Date
}

export class CannotLikeUnpublished extends Error {
  constructor(readonly articleId: ArticleId) {
    super(`Article ${articleId} is not published and cannot be liked`)
    this.name = 'CannotLikeUnpublished'
  }
}

/**
 * A reader's like on a published article.
 *
 * Unpublished articles are off-limits for the same reason bookmarks are:
 * a draft id must not become a handle a reader can sit on.
 */
export class Like {
  private constructor(private readonly props: LikeProps) {}

  static reconstitute(props: LikeProps): Like {
    return new Like(props)
  }

  static create(readerId: UserId, article: Article, now: Date): Like {
    if (!isPubliclyVisible(article.status)) throw new CannotLikeUnpublished(article.id)

    return new Like({
      readerId,
      articleId: article.id,
      likedAt: now,
    })
  }

  get readerId(): UserId {
    return this.props.readerId
  }

  get articleId(): ArticleId {
    return this.props.articleId
  }

  get likedAt(): Date {
    return this.props.likedAt
  }

  snapshot(): LikeProps {
    return this.props
  }
}
