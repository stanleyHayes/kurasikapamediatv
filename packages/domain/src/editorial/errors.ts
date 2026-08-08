import type { ArticleId } from '../shared/ids.js'
import type { ArticleStatus, Transition } from './article-status.js'

export class IllegalTransition extends Error {
  constructor(
    readonly articleId: ArticleId,
    readonly transition: Transition,
    readonly from: ArticleStatus,
  ) {
    super(`Cannot ${transition} an article in state "${from}"`)
    this.name = 'IllegalTransition'
  }
}

export class NotOwnArticle extends Error {
  constructor(readonly articleId: ArticleId) {
    super(`Article ${articleId} belongs to another author`)
    this.name = 'NotOwnArticle'
  }
}

export class MissingApprovedRevision extends Error {
  constructor(readonly articleId: ArticleId) {
    super(`Article ${articleId} has no approved revision to publish`)
    this.name = 'MissingApprovedRevision'
  }
}

export class ScheduleInPast extends Error {
  constructor(readonly at: Date) {
    super(`Cannot schedule publication for ${at.toISOString()} — that is in the past`)
    this.name = 'ScheduleInPast'
  }
}
