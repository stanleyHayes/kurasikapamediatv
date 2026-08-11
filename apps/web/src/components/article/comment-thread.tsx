import { articleId as asArticleId } from '@kurasikapa/domain'
import { container } from '../../composition/container'
import { toCommentView } from '../../read-model/comment-view'
import { CommentForm } from './comment-form'

export async function CommentThread({
  articleId,
}: {
  articleId: string
}): Promise<React.ReactElement> {
  const page = await container().listVisibleComments.execute({
    articleId: asArticleId(articleId),
  })
  const comments = page.items.map(toCommentView)

  return (
    <section className="border-outline-variant mt-12 border-t pt-8" aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="font-display text-on-surface text-xl font-semibold">
        Comments
      </h2>
      {comments.length === 0 ? (
        <p className="text-on-surface-variant mt-4 text-sm">No comments yet.</p>
      ) : (
        <ul className="mt-6 space-y-6">
          {comments.map((comment) => (
            <li key={comment.id}>
              <time dateTime={comment.createdAt} className="text-on-surface-variant text-xs">
                {comment.createdAt.slice(0, 10)}
              </time>
              <p className="text-on-surface mt-1 whitespace-pre-wrap">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}
      <CommentForm articleId={articleId} />
    </section>
  )
}
