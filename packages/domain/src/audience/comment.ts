import type { Article } from '../editorial/article'
import { isPubliclyVisible } from '../editorial/article-status'
import type { ArticleId, CommentId, UserId } from '../shared/ids'

export const COMMENT_STATES = ['pending', 'visible', 'rejected'] as const
export type CommentState = (typeof COMMENT_STATES)[number]

export const MAX_COMMENT_BODY = 2_000

export interface CommentProps {
  readonly id: CommentId
  readonly articleId: ArticleId
  readonly readerId: UserId
  readonly body: string
  readonly state: CommentState
  readonly createdAt: Date
}

export class CannotCommentUnpublished extends Error {
  constructor(readonly articleId: ArticleId) {
    super(`Article ${articleId} is not published and cannot be commented on`)
    this.name = 'CannotCommentUnpublished'
  }
}

export class EmptyComment extends Error {
  constructor() {
    super('A comment needs some text')
    this.name = 'EmptyComment'
  }
}

export class CommentTooLong extends Error {
  constructor(readonly length: number) {
    super(`Comment is ${String(length)} characters; the limit is ${String(MAX_COMMENT_BODY)}`)
    this.name = 'CommentTooLong'
  }
}

export class AlreadyDecided extends Error {
  constructor(readonly id: CommentId) {
    super(`Comment ${id} has already been moderated`)
    this.name = 'AlreadyDecided'
  }
}

/**
 * A reader's remark on a published article.
 *
 * New comments are pending. Nothing reaches the public page until an editor
 * with `comment:moderate` makes it visible — the newsroom analogue of "no AI
 * output without a named approver".
 */
export interface NewComment {
  readonly id: CommentId
  readonly readerId: UserId
  readonly body: string
  readonly now: Date
}

export class Comment {
  private constructor(private readonly props: CommentProps) {}

  static reconstitute(props: CommentProps): Comment {
    return new Comment(props)
  }

  static post(article: Article, input: NewComment): Comment {
    if (!isPubliclyVisible(article.status)) throw new CannotCommentUnpublished(article.id)

    const text = input.body.trim()
    if (text === '') throw new EmptyComment()
    if (text.length > MAX_COMMENT_BODY) throw new CommentTooLong(text.length)

    return new Comment({
      id: input.id,
      articleId: article.id,
      readerId: input.readerId,
      body: text,
      state: 'pending',
      createdAt: input.now,
    })
  }

  approve(): Comment {
    if (this.props.state !== 'pending') throw new AlreadyDecided(this.props.id)
    return new Comment({ ...this.props, state: 'visible' })
  }

  reject(): Comment {
    if (this.props.state !== 'pending') throw new AlreadyDecided(this.props.id)
    return new Comment({ ...this.props, state: 'rejected' })
  }

  get id(): CommentId {
    return this.props.id
  }

  get articleId(): ArticleId {
    return this.props.articleId
  }

  get readerId(): UserId {
    return this.props.readerId
  }

  get body(): string {
    return this.props.body
  }

  get state(): CommentState {
    return this.props.state
  }

  snapshot(): CommentProps {
    return this.props
  }
}
