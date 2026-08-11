import type { Article } from '../editorial/article'
import { isPubliclyVisible } from '../editorial/article-status'
import { type Actor, requirePermission } from '../identity/actor'
import type { ArticleId, UserId } from '../shared/ids'

export interface BreakingAlertProps {
  readonly articleId: ArticleId
  readonly locale: string
  readonly actorId: UserId
  readonly sentAt: Date
}

export class CannotAlertUnpublished extends Error {
  constructor(readonly articleId: ArticleId) {
    super(`Article ${articleId} is not published and cannot raise a breaking alert`)
    this.name = 'CannotAlertUnpublished'
  }
}

/**
 * One blast per article. The newsroom asks for this explicitly — publishing
 * does not mail the list, or every scheduled story would become an alert.
 */
export class BreakingAlert {
  private constructor(private readonly props: BreakingAlertProps) {}

  static reconstitute(props: BreakingAlertProps): BreakingAlert {
    return new BreakingAlert(props)
  }

  static issue(actor: Actor, article: Article, now: Date): BreakingAlert {
    requirePermission(actor, 'article:publish')
    if (!isPubliclyVisible(article.status)) throw new CannotAlertUnpublished(article.id)

    return new BreakingAlert({
      articleId: article.id,
      locale: article.locale,
      actorId: actor.id,
      sentAt: now,
    })
  }

  get articleId(): ArticleId {
    return this.props.articleId
  }

  snapshot(): BreakingAlertProps {
    return this.props
  }
}
