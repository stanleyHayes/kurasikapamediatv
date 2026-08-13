import { articleId as asArticleId } from '@kurasikapa/domain'
import { currentActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'
import { LikeButton } from './like-button'

export async function LikeControl({ articleId }: { articleId: string }): Promise<React.ReactElement> {
  const actor = await currentActor()
  const stats = await container().countLikes.execute({
    articleId: asArticleId(articleId),
    readerId: actor?.id,
  })

  return (
    <LikeButton articleId={articleId} initiallyLiked={stats.liked} initialCount={stats.count} />
  )
}
