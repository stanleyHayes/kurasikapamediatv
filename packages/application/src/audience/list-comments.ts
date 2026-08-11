import { type Actor, type ArticleId, type Comment, requirePermission } from '@kurasikapa/domain'
import { clampLimit, type Page } from '../ports/pagination'
import type { CommentRepository } from '../ports/comment-repository'
import type { UseCase } from '../ports/use-case'

const VISIBLE = { fallback: 20, max: 50 } as const
const PENDING = { fallback: 25, max: 100 } as const

export interface ListVisibleCommentsInput {
  readonly articleId: ArticleId
  readonly after?: string | undefined
  readonly limit?: number | undefined
}

export class ListVisibleComments implements UseCase<ListVisibleCommentsInput, Page<Comment>> {
  constructor(private readonly comments: CommentRepository) {}

  execute(input: ListVisibleCommentsInput): Promise<Page<Comment>> {
    return this.comments.listVisible(input.articleId, {
      after: input.after,
      limit: clampLimit(input.limit, VISIBLE),
    })
  }
}

export interface ListPendingCommentsInput {
  readonly actor: Actor
  readonly after?: string | undefined
  readonly limit?: number | undefined
}

export class ListPendingComments implements UseCase<ListPendingCommentsInput, Page<Comment>> {
  constructor(private readonly comments: CommentRepository) {}

  execute(input: ListPendingCommentsInput): Promise<Page<Comment>> {
    requirePermission(input.actor, 'comment:moderate')

    return this.comments.listPending({
      after: input.after,
      limit: clampLimit(input.limit, PENDING),
    })
  }
}
