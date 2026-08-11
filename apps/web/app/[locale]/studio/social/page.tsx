import type { SocialPost } from '@kurasikapa/domain'
import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { SocialComposer } from '@/components/studio/social-composer'
import { SocialQueue, type QueuedPostView } from '@/components/studio/social-queue'
import { loadPublishedList } from '@/bff/load-public'
import { requireActor } from '@/composition/actor'
import { container } from '@/composition/container'
import { env } from '@/composition/env'
import { toArticleView } from '@/read-model/article-view'

/**
 * The social publishing hub, per the Stitch admin design.
 *
 * The design leads with a month calendar. A calendar is the right surface for
 * a newsroom running dozens of posts a week — but it is also the surface that
 * says least when the queue holds four items, which is where this starts. The
 * list carries the same fields the calendar cells do (platform, time, caption,
 * state) and can grow into the calendar once there is enough in it to warrant
 * one.
 */
const toQueuedPostView = (post: SocialPost): QueuedPostView => {
  const props = post.snapshot()

  return {
    id: props.id,
    platform: props.platform,
    caption: props.caption,
    scheduledAt: props.scheduledAt.toISOString(),
    state: props.state,
    attempts: props.attempts,
    lastError: props.lastError,
  }
}

export default async function SocialPage({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  const actor = await requireActor()

  // Convenience, not security: QueueSocialPost re-checks this, so a
  // hand-crafted POST is refused whatever the UI decides to render.
  if (!actor.can('social:publish')) redirect(`/${locale}/studio`)

  const [queue, published] = await Promise.all([
    container().socialPosts.listQueue({ limit: 50 }),
    loadPublishedList({ locale, limit: 50 }, env().API_URL, async () => {
      const page = await container().listPublishedArticles.execute({ locale, limit: 50 })
      return { items: page.items.map(toArticleView), nextCursor: page.nextCursor }
    }),
  ])

  const posts = queue.items.map(toQueuedPostView)
  const articles = published.items.map((article) => ({
    id: article.id,
    title: article.title,
  }))

  return (
    <div className="space-y-8 pb-20">
      <header>
        {/* No heading here: the contextual top bar already names the section,
            and repeating it gives a screen reader the same title twice. */}
        <p className="text-on-surface-variant text-sm">
          Queue a live article to Facebook and Instagram. Nothing sends until the article is
          published and its scheduled moment arrives.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <section className="lg:col-span-8">
          <SocialQueue posts={posts} locale={locale} />
        </section>

        <section className="lg:col-span-4">
          <div className="border-outline-variant/50 bg-surface-container-low sticky top-6 rounded-xl border p-5">
            <h3 className="font-display text-on-surface mb-4 text-lg font-semibold">Compose</h3>
            <SocialComposer articles={articles} />
          </div>
        </section>
      </div>
    </div>
  )
}
