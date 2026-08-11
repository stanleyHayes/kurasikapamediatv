import { type Actor, type ArticleId, Comment, commentId } from '@kurasikapa/domain'
import { ArticleNotFound } from '../editorial/errors'
import type { ClockPort, IdPort } from '../ports/ambient'
import type { ArticleRepository } from '../ports/article-repository'
import type { CommentRepository } from '../ports/comment-repository'
import type { UseCase } from '../ports/use-case'

export interface PostCommentDeps {
  readonly comments: CommentRepository
  readonly articles: ArticleRepository
  readonly clock: ClockPort
  readonly ids: IdPort
}

export interface PostCommentInput {
  readonly actor: Actor
  readonly articleId: ArticleId
  readonly body: string
}

/**
 * Any signed-in reader may comment. The rule that matters is the domain's:
 * unpublished articles are off-limits, and the remark stays pending until
 * an editor approves it.
 */
export class PostComment implements UseCase<PostCommentInput, { id: string; state: string }> {
  constructor(private readonly deps: PostCommentDeps) {}

  async execute(input: PostCommentInput): Promise<{ id: string; state: string }> {
    const article = await this.deps.articles.findById(input.articleId)
    if (article === null) throw new ArticleNotFound(input.articleId)

    const comment = Comment.post(article, {
      id: commentId(this.deps.ids.next()),
      readerId: input.actor.id,
      body: input.body,
      now: this.deps.clock.now(),
    })
    await this.deps.comments.save(comment)

    return { id: comment.id, state: comment.state }
  }
}
