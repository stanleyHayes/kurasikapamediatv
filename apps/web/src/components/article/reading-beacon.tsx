import { after } from 'next/server'
import { articleId as asArticleId } from '@kurasikapa/domain'
import { currentActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'

/**
 * Notes that this signed-in reader opened the article.
 *
 * Runs after the response via `after()`, so a history write cannot delay the
 * story. Signed-out readers leave no row — there is no anonymous history.
 */
export async function ReadingBeacon({ articleId }: { articleId: string }): Promise<null> {
  const actor = await currentActor()
  if (actor === null) return null

  after(() => {
    void container()
      .recordReading.execute({ actor, articleId: asArticleId(articleId) })
      .catch((error: unknown) => {
        console.error(
          JSON.stringify({
            event: 'reading.record_failed',
            reason: error instanceof Error ? error.message : String(error),
          }),
        )
      })
  })

  return null
}
