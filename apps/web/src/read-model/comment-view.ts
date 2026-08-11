import type { Comment } from '@kurasikapa/domain'

/**
 * A plain object a Server Component can render and pass to a Client Component.
 */
export interface CommentView {
  readonly id: string
  readonly articleId: string
  readonly readerId: string
  readonly body: string
  readonly state: string
  readonly createdAt: string
}

export const toCommentView = (comment: Comment): CommentView => {
  const props = comment.snapshot()

  return {
    id: props.id,
    articleId: props.articleId,
    readerId: props.readerId,
    body: props.body,
    state: props.state,
    createdAt: props.createdAt.toISOString(),
  }
}
