import Image from 'next/image'
import { EmptyState } from '@kurasikapa/ui/empty-state'
import { articleId as asArticleId } from '@kurasikapa/domain'
import { container } from '@kurasikapa/web-kit/composition/container'
import { toCommentView } from '@kurasikapa/web-kit/read-model/comment-view'
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
    <section className="mt-16 overflow-hidden border border-outline-variant bg-surface-container-lowest" aria-labelledby="comments-heading">
      <header className="grid gap-5 border-b border-outline-variant bg-inverse-surface p-6 text-white md:grid-cols-[1fr_auto] md:items-end md:p-9">
        <div><p className="eyebrow mb-3 text-secondary">Reader conversation</p><h2 id="comments-heading" className="font-display text-4xl font-semibold tracking-[-0.04em]">Join the discussion</h2><p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">Add context, ask a useful question, or share what this story means where you are.</p></div>
        <p className="border-l-4 border-secondary pl-4 text-sm font-semibold">{comments.length} {comments.length === 1 ? 'contribution' : 'contributions'}</p>
      </header>
      <div className="p-6 md:p-9">
      {comments.length === 0 ? (
        <EmptyState className="my-6" eyebrow="Reader discussion" title="Start a thoughtful conversation." description="No responses have been published. Add a clear, respectful perspective and the moderation desk will review it before it appears." visual={<Image src="/brand-logo-transparent.png" alt="" width={1536} height={1024} className="h-8 w-auto object-contain" />} compact />
      ) : (
        <ul className="my-7 divide-y divide-outline-variant border-y border-outline-variant">
          {comments.map((comment, index) => (
            <li key={comment.id} className="grid gap-4 py-6 sm:grid-cols-[3rem_1fr]">
              <span aria-hidden className="grid size-12 place-items-center bg-primary font-display text-lg font-bold text-on-primary">{String(index + 1).padStart(2, '0')}</span>
              <div><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-on-surface">Kurasikapa reader</strong><time dateTime={comment.createdAt} className="text-xs text-on-surface-variant">{comment.createdAt.slice(0, 10)}</time></div><p className="mt-3 whitespace-pre-wrap text-[1.05rem] leading-relaxed text-on-surface">{comment.body}</p></div>
            </li>
          ))}
        </ul>
      )}
      <CommentForm articleId={articleId} />
      </div>
    </section>
  )
}
