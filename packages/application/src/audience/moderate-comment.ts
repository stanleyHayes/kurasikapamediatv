import { type Actor, type CommentId, requirePermission } from '@kurasikapa/domain'
import type { CommentRepository } from '../ports/comment-repository'
import type { UseCase } from '../ports/use-case'

export class CommentNotFound extends Error {
  constructor(readonly commentId: CommentId) {
    super(`Comment ${commentId} not found`)
    this.name = 'CommentNotFound'
  }
}

export interface ModerateCommentDeps {
  readonly comments: CommentRepository
}

export interface ModerateCommentInput {
  readonly actor: Actor
  readonly commentId: CommentId
  readonly decision: 'approve' | 'reject'
}

export class ModerateComment implements UseCase<ModerateCommentInput, { state: string }> {
  constructor(private readonly deps: ModerateCommentDeps) {}

  async execute(input: ModerateCommentInput): Promise<{ state: string }> {
    requirePermission(input.actor, 'comment:moderate')

    const found = await this.deps.comments.findById(input.commentId)
    if (found === null) throw new CommentNotFound(input.commentId)

    const next = input.decision === 'approve' ? found.approve() : found.reject()
    await this.deps.comments.save(next)

    return { state: next.state }
  }
}
